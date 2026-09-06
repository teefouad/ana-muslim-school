/**
 * Builds a byte-exact minimal valid PDF (no external dependency, no network
 * fetch) for Storybook stories and tests that need a real `File`/pdf.js
 * document -- verified against pdfjs-dist's own parser. Never used in
 * production code.
 */
export function createTestPdfFile(pageCount = 1, name = "sample.pdf"): File {
  const header = "%PDF-1.4\n";
  const objects: string[] = [];
  const pageIds = Array.from({ length: pageCount }, (_, i) => 3 + i);

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageCount} >>\nendobj\n`,
  );
  for (const id of pageIds) {
    objects.push(
      `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 260] /Resources << >> >>\nendobj\n`,
    );
  }

  let body = "";
  const offsets: number[] = [];
  let cursor = header.length;

  for (const obj of objects) {
    offsets.push(cursor);
    body += obj;
    cursor += obj.length;
  }

  const xrefStart = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdfString = header + body + xref + trailer;
  const bytes = new TextEncoder().encode(pdfString);

  return new File([bytes], name, { type: "application/pdf" });
}
