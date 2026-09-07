import { NextResponse } from "next/server";

import { requireBooksPermission } from "@/lib/auth/require-books-permission";
import { serviceErrorResponse } from "@/lib/http/error-response";
import { parseJsonObject } from "@/lib/http/parse-json-object";
import {
  createSourceService,
  listSourcesService,
} from "@/lib/sources/sources-service";

/** Lists `sources` records, optionally filtered to a single Book via
 * `?bookId=` (ANA-71) -- the filter is applied by the repository's own
 * Firestore query, not by fetching every Source and filtering here. */
export async function GET(request: Request) {
  const auth = await requireBooksPermission("read");

  if (!auth.ok) {
    return auth.response;
  }

  // An empty/whitespace-only `?bookId=` (e.g. a caller building the URL
  // with an unset variable) is treated as "no filter" rather than as a
  // literal filter value that can never match a real Book id (PR review).
  const rawBookId = new URL(request.url).searchParams.get("bookId")?.trim();
  const bookId = rawBookId ? rawBookId : undefined;
  const data = await listSourcesService(bookId);

  return NextResponse.json({ data });
}

/** Creates a new Source. Treated as a Books content change, so it requires `books.update`, not `books.create` (see ANA-62). */
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

  const result = await createSourceService(body.value);

  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json({ data: result.value }, { status: 201 });
}
