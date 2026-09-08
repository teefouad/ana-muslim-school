import { readErrorMessage } from "../fetch-json";
import type { Book } from "@/lib/books/types";
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

/** Deletes a Module via `DELETE /api/v1/books/{bookId}/modules/{moduleId}`
 * (ANA-77) -- the service layer cascades this to delete any Learning
 * Material referencing the Module (still `409`s for Lessons/Questions); the
 * client never orchestrates a separate Material delete itself. */
export async function deleteModule(
  bookId: string,
  moduleId: string,
): Promise<void> {
  const response = await fetch(`/api/v1/books/${bookId}/modules/${moduleId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

/** Persists a new Module order via `PATCH /api/v1/books/{bookId}` (ANA-79)
 * -- `order` must be an exact permutation of the Book's current `modules`
 * ids; the service re-validates this against the live document inside a
 * transaction and rejects a stale/invalid reorder rather than silently
 * dropping or duplicating an id (see lib/books/books-repository.ts). Shared
 * by the saved-Source workspace's Save changes (resolving temporary Module
 * ids to their final order) and Edit Book's Modules panel drag-and-drop. */
export async function reorderModules(
  bookId: string,
  order: string[],
): Promise<Book> {
  const response = await fetch(`/api/v1/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modules: order }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Book };

  return data;
}
