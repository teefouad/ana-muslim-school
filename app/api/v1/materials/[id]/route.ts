import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import {
  deleteMaterialService,
  getMaterialByIdService,
  updateMaterialService,
  upsertMaterialService,
} from "@/lib/materials/materials-service";

/** Reads a single Material by its Firestore document ID. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/v1/materials/[id]">,
) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await getMaterialByIdService(id);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/** Partially updates a Material; fails `404` if it doesn't exist. Requires `books.update` (see ANA-62). */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/v1/materials/[id]">,
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

  const result = await updateMaterialService(id, body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/**
 * Idempotent full upsert at the exact `id` given: creates the Material when
 * missing, fully replaces its writable fields when it exists. Distinct from
 * `PATCH` -- see ANA-62. Requires `books.update`.
 */
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/v1/materials/[id]">,
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

  const result = await upsertMaterialService(id, body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value });
}

/** Deletes a Material. Requires `books.update` (see ANA-62). */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/v1/materials/[id]">,
) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const result = await deleteMaterialService(id);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ ok: true });
}
