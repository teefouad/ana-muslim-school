// Lets a caller retrieve the editor's current selection without reaching
// into MDXEditor/Lexical internals -- for future workflows like creating a
// Section or generating a quiz from selected source text (see ANA-57).
export interface MarkdownEditorHandle {
  /** Plain-text content of the current selection, or "" if there is none. */
  getSelectedText: () => string;
  /** Markdown representation of the current selection, or "" if there is
   * none (see MDXEditor's `getSelectionMarkdown`). */
  getSelectedMarkdown: () => string;
  /** Replaces the editor's displayed Markdown. MDXEditor's `markdown` prop
   * only seeds the editor's *initial* value -- once mounted, an external
   * value change (a form reset, a caller-provided Translate/Suggest action,
   * loading a different record, etc.) must go through this instead. */
  setMarkdown: (markdown: string) => void;
  /** Replaces the current selection with the given Markdown (or inserts at
   * the cursor if the selection is collapsed) -- MDXEditor's own selection-
   * aware primitive, so callers never need to reimplement range replacement
   * by hand (e.g. a selection-scoped AI/Suggest action that must not touch
   * anything outside the exact selected range, see
   * LearningMaterialModuleCard's AI Assistant, ANA-85). */
  insertMarkdown: (markdown: string) => void;
}
