import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { DocumentSnapshot, Timestamp } from "firebase-admin/firestore";

import { BOOKS_COLLECTION } from "@/lib/books/books-repository";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteRefsInBatches } from "@/lib/firestore/delete-refs-in-batches";
import { timestampToDate } from "@/lib/firestore/timestamps";
import { MODULES_COLLECTION } from "@/lib/modules/modules-repository";
import {
  isValidLessonDocument,
  type Lesson,
  type LessonWritableFields,
} from "./types";

const LESSONS_COLLECTION = "lessons";

function moduleRef(bookId: string, moduleId: string) {
  return getAdminFirestore()
    .collection(BOOKS_COLLECTION)
    .doc(bookId)
    .collection(MODULES_COLLECTION)
    .doc(moduleId);
}

function lessonsCollection(bookId: string, moduleId: string) {
  return moduleRef(bookId, moduleId).collection(LESSONS_COLLECTION);
}

function parseLessonDocument(doc: DocumentSnapshot): Lesson | null {
  try {
    const data = doc.data();

    if (!data || !isValidLessonDocument(data)) {
      return null;
    }

    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      type: data.type,
      position: data.position,
      reward: data.reward,
      // A Lesson written before ANA-118 has no `content` key at all --
      // treated as empty content rather than breaking old records (see
      // `Lesson.content`'s own doc in lib/lessons/types.ts).
      content: data.content ?? { ar: "", en: "" },
      duration: data.duration,
      videoURL: data.videoURL,
      azkar: data.azkar,
      questions: data.questions,
      isLocked: data.isLocked,
      isPublished: data.isPublished,
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

/**
 * Creates a Lesson document under `bookId`/`moduleId` and appends its id to
 * the parent Module's `lessons` array, atomically. Returns `null` if the
 * Module doesn't exist, so the caller can respond with a 404.
 */
export async function createLesson(
  bookId: string,
  moduleId: string,
  fields: LessonWritableFields,
  actorEmail: string,
): Promise<Lesson | null> {
  const firestore = getAdminFirestore();
  const parentRef = moduleRef(bookId, moduleId);
  const lessonRef = parentRef.collection(LESSONS_COLLECTION).doc();

  const created = await firestore.runTransaction(async (transaction) => {
    const moduleSnapshot = await transaction.get(parentRef);

    if (!moduleSnapshot.exists) {
      return false;
    }

    transaction.set(lessonRef, {
      ...fields,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorEmail,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });
    transaction.update(parentRef, {
      lessons: FieldValue.arrayUnion(lessonRef.id),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });

    return true;
  });

  if (!created) {
    return null;
  }

  return parseLessonDocument(await lessonRef.get());
}

export async function getLessonById(
  bookId: string,
  moduleId: string,
  lessonId: string,
): Promise<Lesson | null> {
  const snapshot = await lessonsCollection(bookId, moduleId)
    .doc(lessonId)
    .get();

  return snapshot.exists ? parseLessonDocument(snapshot) : null;
}

/**
 * Lists Lessons under `bookId`/`moduleId` in the exact order given by
 * `orderedIds` (the parent `Module.lessons` array -- see ANA-62).
 */
export async function listLessonsByIds(
  bookId: string,
  moduleId: string,
  orderedIds: string[],
): Promise<Lesson[]> {
  if (orderedIds.length === 0) {
    return [];
  }

  const collection = lessonsCollection(bookId, moduleId);
  const snapshots = await getAdminFirestore().getAll(
    ...orderedIds.map((id) => collection.doc(id)),
  );

  return snapshots
    .map(parseLessonDocument)
    .filter((lesson): lesson is Lesson => lesson !== null);
}

type UpdateLessonByIdInput = {
  bookId: string;
  moduleId: string;
  lessonId: string;
  fields: Partial<LessonWritableFields>;
  actorEmail: string;
};

/**
 * Partially updates a Lesson document by id. Returns `null` without writing
 * if `lessonId` doesn't match an existing document under `bookId`/`moduleId`.
 */
export async function updateLessonById({
  bookId,
  moduleId,
  lessonId,
  fields,
  actorEmail,
}: UpdateLessonByIdInput): Promise<Lesson | null> {
  const ref = lessonsCollection(bookId, moduleId).doc(lessonId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  await ref.update({
    ...fields,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorEmail,
  });

  return parseLessonDocument(await ref.get());
}

/**
 * Deletes a Lesson document and removes its id from the parent Module's
 * `lessons` array, atomically -- refreshing the Module's `updatedAt`/
 * `updatedBy` in the same transaction, since removing the id is itself a
 * mutation of the Module document. Referenced Question documents are
 * untouched. Returns `false` without writing if `lessonId` doesn't match an
 * existing document.
 */
export async function deleteLessonById(
  bookId: string,
  moduleId: string,
  lessonId: string,
  actorEmail: string,
): Promise<boolean> {
  const firestore = getAdminFirestore();
  const parentRef = moduleRef(bookId, moduleId);
  const lessonRef = parentRef.collection(LESSONS_COLLECTION).doc(lessonId);

  return firestore.runTransaction(async (transaction) => {
    const lessonSnapshot = await transaction.get(lessonRef);

    if (!lessonSnapshot.exists) {
      return false;
    }

    transaction.delete(lessonRef);
    transaction.update(parentRef, {
      lessons: FieldValue.arrayRemove(lessonId),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail,
    });

    return true;
  });
}

/**
 * Bulk-deletes every Lesson document under `bookId`/`moduleId` without
 * touching `Module.lessons` -- used only by the Book cascade delete (see
 * `deleteBookService` in lib/books/books-service.ts), where the parent
 * Module is being deleted anyway.
 */
export async function deleteAllLessonsForModule(
  bookId: string,
  moduleId: string,
): Promise<void> {
  const snapshot = await lessonsCollection(bookId, moduleId).get();

  await deleteRefsInBatches(
    getAdminFirestore(),
    snapshot.docs.map((doc) => doc.ref),
  );
}

/**
 * Whether any Lesson under `bookId`/`moduleId` references `questionId` in
 * its `questions` array -- used to block Question deletion while it's still
 * referenced (see ANA-62).
 */
export async function isQuestionReferencedByAnyLesson(
  bookId: string,
  moduleId: string,
  questionId: string,
): Promise<boolean> {
  const snapshot = await lessonsCollection(bookId, moduleId)
    .where("questions", "array-contains", questionId)
    .limit(1)
    .get();

  return !snapshot.empty;
}
