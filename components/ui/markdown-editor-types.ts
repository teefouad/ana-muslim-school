// Lets a caller retrieve the editor's current selection without reaching
// into MDXEditor/Lexical internals -- for future workflows like creating a
// Section or generating a quiz from selected source text (see ANA-57).
export interface MarkdownEditorHandle {
  /** Plain-text content of the current selection, or "" if there is none. */
  getSelectedText: () => string;
  /** Markdown representation of the current selection, or "" if there is
   * none (see MDXEditor's `getSelectionMarkdown`). */
  getSelectedMarkdown: () => string;
}
