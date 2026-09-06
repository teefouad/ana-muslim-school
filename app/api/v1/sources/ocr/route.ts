import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { getSessionUser } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { runOcrService } from "@/lib/sources/ocr-service";

/**
 * Runs OCR on the selected pages of a PDF already uploaded via
 * `POST /api/v1/sources/ocr/upload-url` (ANA-68). Treated as a Books content
 * change like every other Source mutation, so it requires `books.update`
 * (see lib/auth/require-books-permission.ts). Ownership, page selection, and
 * file size are independently re-validated server-side in
 * `runOcrService` -- the viewer's own validation is never trusted.
 */
export async function POST(request: Request) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await runOcrService({
    uid: user.uid,
    objectPath: body.value.objectPath,
    pages: body.value.pages,
  });

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
