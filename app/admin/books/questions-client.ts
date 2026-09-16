import { readErrorMessage } from "./fetch-json";
import {
  toQuestionWritableFields,
  type QuestionFieldEntry,
} from "./question-fields";
import type { Question, QuestionWritableFields } from "@/lib/questions/types";

/** Creates a Question under a Module via
 * `POST /api/v1/books/{bookId}/modules/{moduleId}/questions` (ANA-62) --
 * creation alone doesn't attach it to any Lesson; the caller is responsible
 * for including the returned id in `Lesson.questions` (ANA-119). */
export async function createQuestion(
  bookId: string,
  moduleId: string,
  draft: QuestionWritableFields,
): Promise<Question> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Question };

  return data;
}

/** Updates a Question's writable fields via
 * `PATCH /api/v1/books/{bookId}/modules/{moduleId}/questions/{questionId}`
 * (ANA-62). */
export async function updateQuestion(
  bookId: string,
  moduleId: string,
  questionId: string,
  fields: Partial<QuestionWritableFields>,
): Promise<Question> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/questions/${questionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Question };

  return data;
}

/** Persists every local Question draft/edit for a Lesson (ANA-119) -- a new
 * draft (`entry.id === null`) is created via POST, an existing linked
 * Question is updated via PATCH, both through the existing Question APIs.
 * Called only from the Lesson Save flow (edit-module-modal.tsx's
 * `handleCreateLesson`/`handleUpdateLesson`), sequentially and in the
 * entries' current display order, so the returned array is exactly the
 * order to persist into `Lesson.questions`. An entry removed from this
 * Lesson's local list simply never appears here -- its Question document is
 * left untouched, only the reference is dropped (Questions are shared
 * Module resources, never deleted by this flow).
 *
 * `moduleQuestions` is this Module's Questions as last loaded (the same
 * list the Lesson editor was seeded from) -- an existing linked entry whose
 * content still matches its own entry there is reused as-is rather than
 * re-PATCHed, so saving a Lesson never bumps every one of its Questions'
 * `updatedAt`/`updatedBy` merely because the Lesson's own Title/Position/
 * etc. changed (the same snapshot-comparison precedent the old admin's own
 * Question editor used for its "reuse vs. fork" Save decision). */
export async function saveLessonQuestions(
  bookId: string,
  moduleId: string,
  entries: QuestionFieldEntry[],
  moduleQuestions: Question[],
): Promise<Question[]> {
  const originalById = new Map(
    moduleQuestions.map((question) => [question.id, question]),
  );
  const saved: Question[] = [];

  for (const entry of entries) {
    const fields = toQuestionWritableFields(entry);

    if (entry.id) {
      const original = originalById.get(entry.id);
      const unchanged =
        original !== undefined &&
        JSON.stringify(fields) ===
          JSON.stringify({
            text: original.text,
            explanation: original.explanation,
            choices: original.choices,
          });

      saved.push(
        unchanged
          ? original
          : await updateQuestion(bookId, moduleId, entry.id, fields),
      );
    } else {
      saved.push(await createQuestion(bookId, moduleId, fields));
    }
  }

  return saved;
}
