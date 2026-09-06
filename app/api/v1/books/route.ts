import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { createBookService, listBooksService } from "@/lib/books/books-service";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import { serializeAuditFields } from "@/lib/http/serialize-audit-fields";

/** Lists all `books` records. */
export async function GET() {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  const books = await listBooksService();

  return NextResponse.json({ data: books.map(serializeAuditFields) });
}

/** Creates a new Book. `modules` is always server-initialized to `[]`. Requires `books.create`. */
export async function POST(request: Request) {
  const auth = await requireBooksPermission("create");

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

  const result = await createBookService(body.value, auth.actorEmail);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    { data: serializeAuditFields(result.value) },
    { status: 201 },
  );
}
