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
  /** Captures a stable, restorable snapshot of the editor's current
   * selection (its Lexical anchor/focus points) -- `null` when there is no
   * selection or it's collapsed. Node keys stay valid only for the
   * lifetime of *this* mounted editor instance -- a caller must not hold a
   * capture across a remount (e.g. a language-tab switch, which is keyed
   * and remounts the editor). Pairs with `replaceCapturedSelection`, for a
   * selection-scoped action (e.g. AI Assistant, ANA-85, PR review) that
   * needs to survive focus moving elsewhere (a dialog) between capturing
   * the selection and applying its result. */
  captureSelection: () => MarkdownSelectionCapture | null;
  /** Restores a previously captured selection -- independent of whatever
   * the editor's *live* selection currently is -- and replaces exactly
   * that range with the given Markdown, using the editor's own selection-
   * aware node insertion rather than a text search, so identical text
   * elsewhere in the document is never touched. */
  replaceCapturedSelection: (
    capture: MarkdownSelectionCapture,
    markdown: string,
  ) => void;
}

/** An opaque, serializable snapshot of a Lexical `RangeSelection`'s anchor
 * and focus points (node key + offset + point type) -- see
 * `MarkdownEditorHandle.captureSelection`/`replaceCapturedSelection`.
 * Callers should treat this as opaque; only `markdown-editor-core.tsx`
 * interprets it. */
export type MarkdownSelectionCapture = {
  anchorKey: string;
  anchorOffset: number;
  anchorType: "text" | "element";
  focusKey: string;
  focusOffset: number;
  focusType: "text" | "element";
};
