/** One processed page from the Source OCR import flow (ANA-68). */
type OcrPageResult = {
  /** 1-based, matching the PDF viewer's own page numbering. */
  pageNumber: number;
  markdown: string;
};

/** The client-facing OCR result shape returned by `POST /api/v1/sources/ocr`. */
export type OcrResult = {
  model: string;
  pagesProcessed: number;
  docSizeBytes: number | null;
  pages: OcrPageResult[];
};
