import { Text } from "@mantine/core";

import type { OcrResult } from "@/lib/sources/ocr-types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DocumentSummaryProps {
  fileName: string;
  ocrResult: OcrResult;
}

// The filename + pages processed/model/size summary shown on both the OCR
// review header and the Module-building header (ANA-68) -- the latter must
// carry over the exact same document context rather than reducing it to
// just the filename, since both screens describe the same OCR run.
export function DocumentSummary({ fileName, ocrResult }: DocumentSummaryProps) {
  return (
    <div>
      <Text size="sm" fw={500}>
        {fileName}
      </Text>
      <Text size="xs" c="dimmed">
        {ocrResult.pagesProcessed}{" "}
        {ocrResult.pagesProcessed === 1 ? "page" : "pages"} processed
        {" · "}
        {ocrResult.model}
        {ocrResult.docSizeBytes != null &&
          ` · ${formatBytes(ocrResult.docSizeBytes)}`}
      </Text>
    </div>
  );
}
