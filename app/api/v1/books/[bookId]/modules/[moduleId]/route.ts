import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  deleteModuleService,
  getModuleByIdService,
  updateModuleService,
} from "@/lib/modules/modules-service";

/** Reads a single Module under a Book. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId } = await params;
  const result = await getModuleByIdService(bookId, moduleId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/**
 * Partially updates a Module. `lessons` may only be supplied as a same-set
 * reorder of the current child Lesson ids. Requires `books.update` (see
 * ANA-62).
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]">,
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

  const result = await updateModuleService(
    bookId,
    moduleId,
    body.value,
    auth.actorEmail,
  );

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/**
 * Deletes a Module. Fails `409` if it still has Lessons or Questions --
 * unlike Book delete, this never cascades to those. Any Learning Material
 * referencing the Module is deleted as part of this same operation instead
 * of blocking it (ANA-77). Requires `books.update`.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules/[moduleId]">,
) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId, moduleId } = await params;
  const result = await deleteModuleService(bookId, moduleId, auth.actorEmail);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
