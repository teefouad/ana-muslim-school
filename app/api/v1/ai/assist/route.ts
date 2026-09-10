import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { assistLearningMaterialService } from "@/lib/ai/assist-learning-material-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";

/**
 * Runs the Module AI Assistant on a Learning Material draft, with Book
 * context (ANA-85). The narrow REST boundary for ANA-74/ANA-85's server-only
 * `refineLearningMaterial()` -- treated as a Books authoring action, so it
 * requires `books.update` like every other Source/Module/Material mutation
 * (see lib/auth/require-books-permission.ts). The client sends only
 * `bookId`, `text`, `language`, and optional `additionalInstructions`; the
 * Book itself is always loaded server-side from `bookId`. Never persists
 * anything itself -- the caller applies the returned text to its own draft
 * state.
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

  const result = await assistLearningMaterialService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}
