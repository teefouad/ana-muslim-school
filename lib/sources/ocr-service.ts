import "server-only";

import { getAdminStorage } from "@/lib/firebase/admin";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { getMistralClient } from "./mistral-client";
import type { OcrResult } from "./ocr-types";

// mistral-ocr-latest is Mistral's current OCR model alias -- there is no
// existing app-level constant for it to reuse (ANA-68 is the first OCR
// integration in this repo).
const OCR_MODEL = "mistral-ocr-latest";

const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 1000;
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const READ_URL_TTL_MS = 15 * 60 * 1000;

function tempObjectPrefix(uid: string): string {
  return `tmp/ocr-uploads/${uid}/`;
}

function getTempFile(objectPath: string) {
  return getAdminStorage().bucket().file(objectPath);
}

/**
 * Creates a user-scoped random temporary object path and a short-lived
 * signed PUT URL the browser uploads the chosen PDF directly to, bypassing
 * the normal Next.js request body (see ANA-68 -- large PDFs must not be
 * sent through a JSON route).
 */
export async function createOcrUploadUrlService(
  uid: string,
): Promise<ServiceResult<{ uploadUrl: string; objectPath: string }>> {
  const objectPath = `${tempObjectPrefix(uid)}${crypto.randomUUID()}.pdf`;

  try {
    const bucket = getAdminStorage().bucket();
    const [uploadUrl] = await bucket.file(objectPath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + UPLOAD_URL_TTL_MS,
      contentType: "application/pdf",
    });

    return ok({ uploadUrl, objectPath });
  } catch {
    return fail(
      "upstream-error",
      "Could not prepare the upload. Please try again.",
    );
  }
}

function parsePages(
  pages: unknown,
): { ok: true; value: number[] } | { ok: false; message: string } {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, message: "`pages` must be a non-empty array." };
  }

  for (const page of pages) {
    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
      return {
        ok: false,
        message: "Every page must be a finite integer of 1 or greater.",
      };
    }
  }

  const deduped = Array.from(new Set(pages as number[])).sort((a, b) => a - b);

  if (deduped.length > MAX_PAGES) {
    return {
      ok: false,
      message: `No more than ${MAX_PAGES} pages may be selected.`,
    };
  }

  return { ok: true, value: deduped };
}

/**
 * Runs OCR on the selected pages of a temporary PDF previously uploaded via
 * `createOcrUploadUrlService`. Independently re-validates ownership, page
 * selection, and file size server-side -- the viewer's own validation is
 * never trusted (ANA-68).
 *
 * The temporary object is always deleted once this settles (success or
 * failure) via the `finally` below, so a failed OCR attempt never leaves
 * the uploaded PDF sitting in Storage.
 */
export async function runOcrService({
  uid,
  objectPath,
  pages,
}: {
  uid: string;
  objectPath: unknown;
  pages: unknown;
}): Promise<ServiceResult<OcrResult>> {
  if (
    typeof objectPath !== "string" ||
    !objectPath.startsWith(tempObjectPrefix(uid))
  ) {
    return fail("invalid-input", "Invalid objectPath.");
  }

  const parsedPages = parsePages(pages);

  if (!parsedPages.ok) {
    return fail("invalid-input", parsedPages.message);
  }

  let file: ReturnType<typeof getTempFile>;

  try {
    file = getTempFile(objectPath);
  } catch {
    // getAdminStorage() throws on a Storage misconfiguration (e.g. missing
    // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) -- caught here rather than
    // letting it crash the route with an unhandled exception.
    return fail(
      "upstream-error",
      "Could not access temporary storage. Please try again.",
    );
  }

  try {
    let sizeBytes: number;

    try {
      const [metadata] = await file.getMetadata();
      sizeBytes = Number(metadata.size) || 0;
    } catch (error) {
      // A 404 from the metadata lookup means the object doesn't exist --
      // no need for a separate file.exists() round-trip first to learn the
      // same thing.
      if ((error as { code?: number } | undefined)?.code === 404) {
        return fail(
          "invalid-input",
          "The uploaded file could not be found. Please choose the file again.",
        );
      }

      return fail(
        "upstream-error",
        "Could not read the uploaded file. Please try again.",
      );
    }

    if (sizeBytes === 0) {
      return fail("invalid-input", "The uploaded file is empty.");
    }

    if (sizeBytes > MAX_PDF_SIZE_BYTES) {
      return fail("too-large", "The PDF exceeds the 100 MB size limit.");
    }

    let readUrl: string;

    try {
      [readUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + READ_URL_TTL_MS,
      });
    } catch {
      return fail(
        "upstream-error",
        "Could not prepare the file for OCR. Please try again.",
      );
    }

    let mistralClient;

    try {
      mistralClient = getMistralClient();
    } catch {
      // Missing MISTRAL_API_KEY is a deployment misconfiguration, not a
      // transient provider failure -- surfaced distinctly so it isn't
      // mistaken for (and endlessly retried like) Mistral being down.
      return fail(
        "upstream-error",
        "OCR is not configured. Please contact an administrator.",
      );
    }

    try {
      // Viewer page numbers are 1-based; Mistral page indexes are 0-based.
      const response = await mistralClient.ocr.process({
        model: OCR_MODEL,
        document: { type: "document_url", documentUrl: readUrl },
        pages: parsedPages.value.map((pageNumber) => pageNumber - 1),
      });

      const resultPages = response.pages
        .map((page) => ({
          pageNumber: page.index + 1,
          markdown: page.markdown ?? "",
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);

      return ok({
        model: response.model,
        pagesProcessed: resultPages.length,
        docSizeBytes: sizeBytes,
        pages: resultPages,
      });
    } catch {
      return fail("upstream-error", "OCR processing failed. Please try again.");
    }
  } finally {
    // Best-effort cleanup -- an orphaned temp object is preferable to a
    // delete failure here masking the real success/failure result above.
    await file.delete().catch(() => {});
  }
}
