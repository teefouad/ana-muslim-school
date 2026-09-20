import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { generateQuestionsService } from "@/lib/ai/generate-questions-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";

/**
 * Runs the Generate Questions AI task (ANA-131) for the Lesson Questions
 * editor's Generate modal: `sourceText` (the passage/source text to
 * generate from), an optional `additionalInstructions`, and `count` (how
 * many questions to generate). Never persists anything itself -- the caller
 * inserts the returned questions into its own draft Question list, same as
 * every other `/api/v1/ai/*` route.
 */
export async function POST(request: Request) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await generateQuestionsService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
