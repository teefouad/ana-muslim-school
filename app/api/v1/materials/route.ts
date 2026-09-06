import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import {
  createMaterialService,
  listMaterialsService,
} from "@/lib/materials/materials-service";

/** Lists all `materials` records. */
export async function GET() {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const data = await listMaterialsService();

  return NextResponse.json({ data });
}

/** Creates a new Material with a server-generated document id. Requires `books.update` (see ANA-62). */
export async function POST(request: Request) {
  const auth = await requireBooksPermission("update");

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonObject(request);

  if (!body.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await createMaterialService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value }, { status: 201 });
}
