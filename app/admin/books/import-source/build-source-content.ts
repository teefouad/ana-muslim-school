/** Builds the full reviewed Source text (ANA-71) from the Import Source
 * workflow's per-page edited Markdown, keyed by 1-based page number --
 * ascending page order, one blank line between pages, regardless of the
 * order pages were extracted or edited in. */
export function buildSourceContent(
  editedMarkdown: Record<number, string>,
): string {
  return Object.entries(editedMarkdown)
    .map(([pageNumber, markdown]) => ({
      pageNumber: Number(pageNumber),
      markdown,
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => page.markdown)
    .join("\n\n");
}
