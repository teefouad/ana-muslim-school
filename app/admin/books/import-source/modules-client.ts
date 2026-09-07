import { readErrorMessage } from "../fetch-json";
import type { Module, ModuleWritableFields } from "@/lib/modules/types";

/** Creates a Module under a Book via `POST /api/v1/books/{bookId}/modules`
 * (ANA-70) -- the existing endpoint atomically appends the new Module's id
 * to `Book.modules`, so no separate write is needed to attach it. */
export async function createModule(
  bookId: string,
  draft: ModuleWritableFields,
): Promise<Module> {
  const response = await fetch(`/api/v1/books/${bookId}/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Module };

  return data;
}
