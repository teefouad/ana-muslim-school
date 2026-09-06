import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  createQuestionService,
  listQuestionsService,
} from "@/lib/questions/questions-service";

type Context =
  RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]/questions">;

/** Lists Questions under a Module. No ordering guarantee (see ANA-62). */
export async function GET(_request: Request, { params }: Context) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId } = await params;
  const result = await listQuestionsService(bookId, moduleId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value.map(serializeAuditFields) });
}

/**
 * Creates a Question under a Module. Question creation alone does not
 * attach it to any Lesson -- see ANA-62. Requires `books.update`.
 */
export async function POST(request: Request, { params }: Context) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await createQuestionService(
    bookId,
    moduleId,
    body.value,
    auth.actorEmail,
  );

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    { data: serializeAuditFields(result.value) },
    { status: 201 },
  );
}
