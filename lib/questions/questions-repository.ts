import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { DocumentSnapshot, Timestamp } from "firebase-admin/firestore";

import { BOOKS_COLLECTION } from "@/lib/books/books-repository";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteRefsInBatches } from "@/lib/firestore/delete-refs-in-batches";
import { timestampToDate } from "@/lib/firestore/timestamps";
import { MODULES_COLLECTION } from "@/lib/modules/modules-repository";
import {
  isValidQuestionDocument,
  type Question,
  type QuestionWritableFields,
} from "./types";

const QUESTIONS_COLLECTION = "questions";

function questionsCollection(bookId: string, moduleId: string) {
  return getAdminFirestore()
    .collection(BOOKS_COLLECTION)
    .doc(bookId)
    .collection(MODULES_COLLECTION)
    .doc(moduleId)
    .collection(QUESTIONS_COLLECTION);
}

function parseQuestionDocument(doc: DocumentSnapshot): Question | null {
  try {
    const data = doc.data();

    if (!data || !isValidQuestionDocument(data)) {
      return null;
    }

    return {
      id: doc.id,
      text: data.text,
      explanation: data.explanation,
      choices: data.choices,
      createdAt:
        timestampToDate(data.createdAt as Timestamp | undefined) ?? new Date(0),
      updatedAt:
        timestampToDate(data.updatedAt as Timestamp | undefined) ?? new Date(0),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  } catch {
    return null;
  }
}

export async function createQuestion(
  bookId: string,
  moduleId: string,
  fields: QuestionWritableFields,
  actorEmail: string,
): Promise<Question> {
  const ref = questionsCollection(bookId, moduleId).doc();

  await ref.set({
    ...fields,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorEmail,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  });

  const question = parseQuestionDocument(await ref.get());

  if (!question) {
    throw new Error("Failed to read back the newly created Question document.");
  }

  return question;
}

export async function getQuestionById(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<Question | null> {
  const snapshot = await questionsCollection(bookId, moduleId)
    .doc(questionId)
    .get();

  return snapshot.exists ? parseQuestionDocument(snapshot) : null;
}

export async function questionExists(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<boolean> {
  const snapshot = await questionsCollection(bookId, moduleId)
    .doc(questionId)
    .get();

  return snapshot.exists;
}

/**
 * Checks that every id in `questionIds` exists as a Question document under
 * `bookId`/`moduleId` -- used to validate `Lesson.questions` references
 * (see lib/lessons/lessons-service.ts). No ordering guarantee is required
 * for module-level Questions (see ANA-62).
 */
export async function allQuestionsExist(
  bookId: string,
  moduleId: string,
  questionIds: string[],
): Promise<boolean> {
  if (questionIds.length === 0) {
    return true;
  }

  const collection = questionsCollection(bookId, moduleId);
  const snapshots = await getAdminFirestore().getAll(
    ...questionIds.map((id) => collection.doc(id)),
  );

  return snapshots.every((snapshot) => snapshot.exists);
}

/** Whether any Question document exists under `bookId`/`moduleId` -- used to block Module deletion while it still has Questions (see ANA-62). */
export async function anyQuestionExists(
  bookId: string,
  moduleId: string,
): Promise<boolean> {
  const snapshot = await questionsCollection(bookId, moduleId).limit(1).get();

  return !snapshot.empty;
}

export async function listQuestions(
  bookId: string,
  moduleId: string,
): Promise<Question[]> {
  const snapshot = await questionsCollection(bookId, moduleId).get();

  return snapshot.docs
    .map(parseQuestionDocument)
    .filter((question): question is Question => question !== null);
}

type UpdateQuestionByIdInput = {
  bookId: string;
  moduleId: string;
  questionId: string;
  fields: Partial<QuestionWritableFields>;
  actorEmail: string;
};

export async function updateQuestionById({
  bookId,
  moduleId,
  questionId,
  fields,
  actorEmail,
}: UpdateQuestionByIdInput): Promise<Question | null> {
  const ref = questionsCollection(bookId, moduleId).doc(questionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  await ref.update({
    ...fields,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  });

  return parseQuestionDocument(await ref.get());
}

/**
 * Returns `false` without deleting if `questionId` doesn't match an existing
 * document. Callers must already have verified no Lesson references it --
 * see `deleteQuestionService` in lib/questions/questions-service.ts.
 */
export async function deleteQuestionById(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<boolean> {
  const ref = questionsCollection(bookId, moduleId).doc(questionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return false;
  }

  await ref.delete();

  return true;
}

/**
 * Bulk-deletes every Question document under `bookId`/`moduleId` -- used
 * only by the Book cascade delete (see `deleteBookService` in
 * lib/books/books-service.ts).
 */
export async function deleteAllQuestionsForModule(
  bookId: string,
  moduleId: string,
): Promise<void> {
  const snapshot = await questionsCollection(bookId, moduleId).get();

  await deleteRefsInBatches(
    getAdminFirestore(),
    snapshot.docs.map((doc) => doc.ref),
  );
}
