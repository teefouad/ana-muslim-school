import type { TranslatableString } from "@/lib/learning-content/translatable-string";

/** A workflow-local, unsaved Module created from a Source Text selection on
 * the Module-building screen (ANA-68) -- the same final editing screen used
 * for the rest of the Create-from-PDF flow (ANA-75; the separate Learning
 * Material step was removed). Never sent to
 * `/api/v1/books/{bookId}/modules` -- persistence happens only once Finish
 * runs (see lib/modules/types.ts for the real, Firestore-backed `Module`).
 * `material` is the same bilingual `{ ar, en }` shape as the persisted
 * `Material.content`: the selected Source text seeds `material.ar`, leaving
 * `material.en` empty, and the user edits both directly in the shared
 * `LearningMaterialModuleCard` -- there is no separate raw-text
 * representation of the same Module content. */
export type TempModule = {
  id: string;
  material: TranslatableString;
};

export type TextDirection = "ltr" | "rtl";

/** A Module shown in the saved-Source Modules panel (ANA-72), paired with
 * its Learning Material draft -- the same bilingual `{ ar, en }` shape as
 * the persisted `Material.content` (ANA-75), so a Module card can hold both
 * languages' drafts at once instead of only whichever one is showing.
 * `moduleId` is `null` for a Module created from a Source Text selection in
 * the current modal session and not yet persisted -- Save Changes creates
 * it via `POST /api/v1/books/{bookId}/modules` before creating its
 * Material. The selected Source text seeds `material.ar` as a starting
 * draft the user then edits (PR review), leaving `material.en` empty -- it
 * isn't stored anywhere else: there is no persisted Source->Module
 * relationship or separate source-text field on `Module` (see
 * lib/modules/types.ts). */
export type WorkspaceModuleEntry = {
  key: string;
  moduleId: string | null;
  material: TranslatableString;
};
