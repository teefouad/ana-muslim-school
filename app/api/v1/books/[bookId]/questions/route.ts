import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import { getBookQuestionsGroupedByModuleService } from "@/lib/questions/book-questions-service";

type Context = RouteContext<"/api/v1/books/[bookId]/questions">;

/**
 * Lists every Question under a Book, grouped by Module in `Book.modules`
 * order, from the in-memory per-book cache (see ANA-108). Pass `?refresh`
 * or `?invalidate` (either works; the value is ignored) to bypass the
 * cache and replace it with a fresh read from Firestore.
 */
export async function GET(request: Request, { params }: Context) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId } = await params;
  const { searchParams } = new URL(request.url);
  const forceRefresh =
    searchParams.has("refresh") || searchParams.has("invalidate");

  const result = await getBookQuestionsGroupedByModuleService(
    bookId,
    forceRefresh,
  );

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({
    data: result.value.map((group) => ({
      moduleId: group.moduleId,
      questions: group.questions.map(serializeAuditFields),
    })),
  });
}
