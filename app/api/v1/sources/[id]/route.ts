import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import {
  deleteSourceService,
  getSourceByIdService,
  updateSourceService,
} from "@/lib/sources/sources-service";

/** Reads a single Source by its Firestore document ID. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/sources/[id]">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await getSourceByIdService(id);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/** Partially updates a Source. Requires `books.update` (see ANA-62). */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/v1/sources/[id]">,
) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updateSourceService(id, body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/** Deletes a Source. Requires `books.update` (see ANA-62). */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/v1/sources/[id]">,
) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await deleteSourceService(id);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
