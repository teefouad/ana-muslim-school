import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";
import {
  createModuleService,
  listModulesService,
} from "@/lib/modules/modules-service";

/** Lists Modules under a Book, in `Book.modules` order. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { bookId } = await params;
  const result = await listModulesService(bookId);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value.map(serializeAuditFields) });
}

/**
 * Creates a Module under a Book and appends its id to `Book.modules`,
 * atomically. `lessons` is always server-initialized to `[]`. Treated as a
 * Books content change, so it requires `books.update` (see ANA-62).
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/v1/books/[bookId]/modules">,
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

  const result = await createModuleService(bookId, body.value, auth.actorEmail);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    { data: serializeAuditFields(result.value) },
    { status: 201 },
  );
}
