import type { TranslatedValue } from "@/components/ui/translatable-value";
import { LESSON_TYPES, type LessonType } from "@/lib/lessons/types";

/**
 * Frontend-only fixture shape for the Lessons list inside the Edit Module
 * modal (ANA-111) -- not the real Lesson persistence model (see
 * `lib/lessons/types.ts` for the Firestore-backed `Lesson`). This task is
 * UI only: Lessons live in local component state and are never loaded from
 * or saved to the backend (that starts with ANA-110). `type`, `description`,
 * and `isPublished` were added in ANA-114 for the basic Lesson form -- still
 * local-only, and still not the canonical backend defaults for a real
 * Lesson (`type` reuses the real `LessonType` domain values, ANA-114, so
 * this fixture never invents its own).
 */
export interface MockLesson {
  id: string;
  title: TranslatedValue;
  description: TranslatedValue;
  type: LessonType;
  /** An ordinary client-controlled numeric field, `0` through `4` -- see
   * `createMockLesson`'s default below and ANA-110/ANA-114. */
  position: number;
  isPublished: boolean;
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
    title: {},
    description: {},
    type: LESSON_TYPES[0],
    position: 2,
    isPublished: false,
  };
}
