import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  deleteLessonService,
  getLessonByIdService,
  updateLessonService,
} from "@/lib/lessons/lessons-service";

type Context =
  RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]/lessons/[lessonId]">;

/** Reads a single Lesson under a Module. */
export async function GET(_request: Request, { params }: Context) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, lessonId } = await params;
  const result = await getLessonByIdService(bookId, moduleId, lessonId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/**
 * Partially updates a Lesson, including its `questions` references (each
 * must exist in the same Module, no duplicates/foreign ids). Requires
 * `books.update` (see ANA-62).
 */
export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, lessonId } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updateLessonService(
    bookId,
    moduleId,
    lessonId,
    body.value,
    auth.actorEmail,
  );

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/** Removes the Lesson from `Module.lessons`; referenced Questions are untouched. Requires `books.update`. */
export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId, lessonId } = await params;
  const result = await deleteLessonService(bookId, moduleId, lessonId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
