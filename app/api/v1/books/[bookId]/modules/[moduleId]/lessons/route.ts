import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  createLessonService,
  listLessonsService,
} from "@/lib/lessons/lessons-service";

/** Lists Lessons under a Module, in `Module.lessons` order. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]/lessons">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId } = await params;
  const result = await listLessonsService(bookId, moduleId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value.map(serializeAuditFields) });
}

/**
 * Creates a Lesson under a Module and appends its id to `Module.lessons`,
 * atomically. `position` is an ordinary client-controlled field with no
 * relationship to list order (see ANA-62). Requires `books.update`.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]/lessons">,
) {
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

  const result = await createLessonService(
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
