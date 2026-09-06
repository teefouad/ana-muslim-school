import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  deleteQuestionService,
  getQuestionByIdService,
  updateQuestionService,
} from "@/lib/questions/questions-service";

type Context =
  RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]/questions/[questionId]">;

/** Reads a single Question under a Module. */
export async function GET(_request: Request, { params }: Context) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, questionId } = await params;
  const result = await getQuestionByIdService(bookId, moduleId, questionId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/** Partially updates a Question. Requires `books.update` (see ANA-62). */
export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, questionId } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updateQuestionService(
    bookId,
    moduleId,
    questionId,
    body.value,
    auth.actorEmail,
  );

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/** Fails `409` while any Lesson in the Module still references this Question. Requires `books.update`. */
export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, questionId } = await params;
  const result = await deleteQuestionService(bookId, moduleId, questionId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
