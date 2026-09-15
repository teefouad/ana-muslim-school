import { readErrorMessage } from "../fetch-json";
import type { Lesson, LessonWritableFields } from "@/lib/lessons/types";

/** Creates a Lesson under a Module via
 * `POST /api/v1/books/{bookId}/modules/{moduleId}/lessons` (ANA-116) -- the
 * existing endpoint atomically appends the new Lesson's id to
 * `Module.lessons`, so no separate write is needed to attach it. */
export async function createLesson(
  bookId: string,
  moduleId: string,
  draft: LessonWritableFields,
): Promise<Lesson> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/lessons`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Lesson };

  return data;
}

/** Updates a Lesson's writable fields via
 * `PATCH /api/v1/books/{bookId}/modules/{moduleId}/lessons/{lessonId}`
 * (ANA-116) -- every field is optional server-side (an omitted one is left
 * unchanged), so the Lesson editor only ever sends the five fields it
 * exposes, never resetting `reward`/`duration`/`videoURL`/`azkar`/
 * `questions`/`isLocked`. */
export async function updateLesson(
  bookId: string,
  moduleId: string,
  lessonId: string,
  fields: Partial<LessonWritableFields>,
): Promise<Lesson> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/lessons/${lessonId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Lesson };

  return data;
}

/** Deletes a Lesson via
 * `DELETE /api/v1/books/{bookId}/modules/{moduleId}/lessons/{lessonId}`
 * (ANA-116) -- the service layer removes it from `Module.lessons`;
 * referenced Question documents are untouched. */
export async function deleteLesson(
  bookId: string,
  moduleId: string,
  lessonId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/lessons/${lessonId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
