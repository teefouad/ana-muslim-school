import { readErrorMessage } from "./fetch-json";
import type { Lesson, LessonWritableFields } from "@/lib/lessons/types";
import type { Module } from "@/lib/modules/types";

/**
 * The writable fields a newly created Lesson gets when created through Add
 * Lesson (ANA-111). The Lesson form itself is out of scope for this task
 * (ANA-110) -- Add Lesson has no fields of its own to collect, so every new
 * Lesson starts from this same fixed set of defaults instead, matching
 * `position`'s documented default of `2` (ANA-110) and Module's own
 * `isLocked`/`isPublished: false`-on-create convention (module-fields.ts).
 */
const DEFAULT_LESSON_FIELDS: LessonWritableFields = {
  title: { ar: "", en: "" },
  description: { ar: "", en: "" },
  type: "text",
  position: 2,
  reward: { coins: 0 },
  duration: 0,
  videoURL: "",
  azkar: [],
  questions: [],
  isLocked: false,
  isPublished: false,
};

/** Creates a Lesson under a Module via
 * `POST /api/v1/books/{bookId}/modules/{moduleId}/lessons` (ANA-111), using
 * `DEFAULT_LESSON_FIELDS` -- the endpoint atomically appends the new
 * Lesson's id to `Module.lessons`, so no separate write is needed to attach
 * it. */
export async function createLesson(
  bookId: string,
  moduleId: string,
): Promise<Lesson> {
  const response = await fetch(
    `/api/v1/books/${bookId}/modules/${moduleId}/lessons`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_LESSON_FIELDS),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Lesson };

  return data;
}

/** Persists a new Lesson order via
 * `PATCH /api/v1/books/{bookId}/modules/{moduleId}` (ANA-111) -- `order`
 * must be an exact permutation of the Module's current `lessons` ids; the
 * service re-validates this against the live document inside a transaction
 * (see lib/modules/modules-repository.ts), exactly like `reorderModules` for
 * `Book.modules`. */
export async function reorderLessons(
  bookId: string,
  moduleId: string,
  order: string[],
): Promise<Module> {
  const response = await fetch(`/api/v1/books/${bookId}/modules/${moduleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessons: order }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Module };

  return data;
}
