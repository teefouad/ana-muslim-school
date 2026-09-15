/**
 * Frontend-only fixture shape for the Lessons list inside the Edit Module
 * modal (ANA-111) -- not the real Lesson persistence model (see
 * `lib/lessons/types.ts` for the Firestore-backed `Lesson`). This task is
 * UI only: Lessons live in local component state and are never loaded from
 * or saved to the backend (that starts with ANA-110).
 */
export interface MockLesson {
  id: string;
  title: string;
  position: number;
}

/**
 * Builds a new local-only Lesson for the Add Lesson action (ANA-111).
 * `position` defaults to 2, matching the default already specified for the
 * full Lesson editor in ANA-110 -- no other field here should be read as a
 * canonical backend default.
 */
export function createMockLesson(): MockLesson {
  return {
    id: crypto.randomUUID(),
    title: "",
    position: 2,
  };
}
