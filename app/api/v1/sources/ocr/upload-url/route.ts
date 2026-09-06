import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { getSessionUser } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { createOcrUploadUrlService } from "@/lib/sources/ocr-service";

/**
 * Creates a short-lived signed Firebase Storage upload URL for a PDF the
 * Import Source modal is about to OCR (ANA-68). Treated as a Books content
 * change like every other Source mutation, so it requires `books.update`
 * (see lib/auth/require-books-permission.ts).
 */
export async function POST() {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await createOcrUploadUrlService(user.uid);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
