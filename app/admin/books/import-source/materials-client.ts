import { readErrorMessage } from "../fetch-json";
import type { Material } from "@/lib/materials/types";

/** Creates one Learning Material for a persisted Module via
 * `POST /api/v1/materials` (ANA-71) -- `moduleId` must already be the real,
 * persisted Module id (never the workflow's temporary Module id). */
export async function createMaterial(
  bookId: string,
  moduleId: string,
  content: string,
): Promise<Material> {
  const response = await fetch("/api/v1/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, moduleId, content }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Material };

  return data;
}

/** Updates a Material's content via `PATCH /api/v1/materials/{id}` (ANA-72)
 * -- used to save edits to a Learning Material that was already persisted. */
export async function updateMaterial(
  id: string,
  content: string,
): Promise<Material> {
  const response = await fetch(`/api/v1/materials/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: Material };

  return data;
}
