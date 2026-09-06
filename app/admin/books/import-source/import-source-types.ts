/** A workflow-local, unsaved Module created from selected extracted text on
 * the Module-building screen (ANA-68). Never sent to
 * `/api/v1/books/{bookId}/modules` -- persistence is out of scope for this
 * card (see lib/modules/types.ts for the real, Firestore-backed `Module`). */
export type TempModule = {
  id: string;
  text: string;
};

export type TextDirection = "ltr" | "rtl";
