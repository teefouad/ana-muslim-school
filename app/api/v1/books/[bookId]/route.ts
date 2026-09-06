import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import {
  deleteBookService,
  getBookByIdService,
  updateBookService,
} from "@/lib/books/books-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";

/** Reads a single Book by its Firestore document ID. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId } = await params;
  const result = await getBookByIdService(bookId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/**
 * Partially updates a Book. `modules` may only be supplied as a same-set
 * reorder of the current child Module ids -- see ANA-62. Requires
 * `books.update`.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]">,
) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updateBookService(bookId, body.value, auth.actorEmail);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: serializeAuditFields(result.value) });
}

/**
 * Deletes a Book and cascades to every nested Module/Lesson/Question and
 * every root Source/Material associated with it -- see ANA-62. Requires
 * `books.delete`.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]">,
) {
  const auth = await requireBooksPermission("delete");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId } = await params;
  const result = await deleteBookService(bookId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
