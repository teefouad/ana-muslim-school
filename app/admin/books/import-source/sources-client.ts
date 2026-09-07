import { readErrorMessage } from "../fetch-json";
import type { Source } from "@/lib/sources/types";

/** Creates the Book's Source via `POST /api/v1/sources` (ANA-71) -- this
 * import flow treats a Book as having one active Source, so callers only
 * invoke this when they've already confirmed (via the Source-by-bookId
 * lookup) that none exists yet. */
export async function createSource(
  bookId: string,
  content: string,
): Promise<Source> {
  const response = await fetch("/api/v1/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, content }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Source };

  return data;
}

/** Deletes a Source via `DELETE /api/v1/sources/{id}` (ANA-71) -- deletes
 * only the Source record; Modules/Materials are untouched. */
export async function deleteSource(id: string): Promise<void> {
  const response = await fetch(`/api/v1/sources/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

/** Updates a Source's content via `PATCH /api/v1/sources/{id}` -- used to
 * save edits made directly in the saved-source view. */
export async function updateSource(
  id: string,
  content: string,
): Promise<Source> {
  const response = await fetch(`/api/v1/sources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Source };

  return data;
}
