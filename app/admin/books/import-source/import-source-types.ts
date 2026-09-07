/** A workflow-local, unsaved Module created from selected extracted text on
 * the Module-building screen (ANA-68). Never sent to
 * `/api/v1/books/{bookId}/modules` -- persistence is out of scope for this
 * card (see lib/modules/types.ts for the real, Firestore-backed `Module`). */
export type TempModule = {
  id: string;
  text: string;
};

export type TextDirection = "ltr" | "rtl";

/** A Module shown in the saved-Source Modules panel (ANA-72), paired with
 * its Learning Material Markdown draft. `moduleId` is `null` for a Module
 * created from a Source Text selection in the current modal session and
 * not yet persisted -- Save Changes creates it via
 * `POST /api/v1/books/{bookId}/modules` before creating its Material. There
 * is no persisted Source->Module relationship: the selection that created
 * a new entry is only a UI trigger and is never stored on it (see
 * lib/modules/types.ts -- `Module` has no source-text field). */
export type WorkspaceModuleEntry = {
  key: string;
  moduleId: string | null;
  material: string;
};
