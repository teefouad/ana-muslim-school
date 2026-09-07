import "server-only";

import { bookExists } from "@/lib/books/books-service";
import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { moduleExists } from "@/lib/modules/modules-service";
import {
  createMaterial as createMaterialInRepo,
  deleteMaterialById,
  getMaterialById as getMaterialByIdFromRepo,
  listMaterials as listMaterialsFromRepo,
  updateMaterialById,
  upsertMaterialById,
} from "./materials-repository";
import type { Material, MaterialWritableFields } from "./types";
import {
  parseMaterialPatchInput,
  parseMaterialWritableInput,
} from "./validation";

async function validateHierarchy(
  bookId: string,
  moduleId: string,
): Promise<string | null> {
  if (!(await bookExists(bookId))) {
    return "`bookId` does not reference an existing Book.";
  }

  if (!(await moduleExists(bookId, moduleId))) {
    return "`moduleId` does not reference a Module under `bookId`.";
  }

  return null;
}

export async function listMaterialsService(
  bookId?: string,
): Promise<Material[]> {
  return listMaterialsFromRepo(bookId);
}

export async function createMaterialService(
  body: Record<string, unknown>,
): Promise<ServiceResult<Material>> {
  const parsed = parseMaterialWritableInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const hierarchyError = await validateHierarchy(
    parsed.value.bookId,
    parsed.value.moduleId,
  );

  if (hierarchyError) {
    return fail("invalid-input", hierarchyError);
  }

  const material = await createMaterialInRepo(parsed.value);

  return ok(material);
}

export async function getMaterialByIdService(
  id: string,
): Promise<ServiceResult<Material>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid material id.");
  }

  const material = await getMaterialByIdFromRepo(id);

  return material ? ok(material) : fail("not-found", "Material not found.");
}

export async function updateMaterialService(
  id: string,
  body: Record<string, unknown>,
): Promise<ServiceResult<Material>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid material id.");
  }

  const current = await getMaterialByIdFromRepo(id);

  if (!current) {
    return fail("not-found", "Material not found.");
  }

  const parsed = parseMaterialPatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  if (
    parsed.value.bookId !== undefined ||
    parsed.value.moduleId !== undefined
  ) {
    const resultingBookId = parsed.value.bookId ?? current.bookId;
    const resultingModuleId = parsed.value.moduleId ?? current.moduleId;

    const hierarchyError = await validateHierarchy(
      resultingBookId,
      resultingModuleId,
    );

    if (hierarchyError) {
      return fail("invalid-input", hierarchyError);
    }
  }

  const updated = await updateMaterialById(id, parsed.value);

  return updated ? ok(updated) : fail("not-found", "Material not found.");
}

/**
 * Idempotent full upsert at the exact `id` given (see ANA-62): creates the
 * Material when missing, fully replaces its writable fields when it exists.
 */
export async function upsertMaterialService(
  id: string,
  body: Record<string, unknown>,
): Promise<ServiceResult<Material>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid material id.");
  }

  const parsed = parseMaterialWritableInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  const hierarchyError = await validateHierarchy(
    parsed.value.bookId,
    parsed.value.moduleId,
  );

  if (hierarchyError) {
    return fail("invalid-input", hierarchyError);
  }

  const material = await upsertMaterialById(
    id,
    parsed.value as MaterialWritableFields,
  );

  return ok(material);
}

export async function deleteMaterialService(
  id: string,
): Promise<ServiceResult<void>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid material id.");
  }

  const deleted = await deleteMaterialById(id);

  return deleted ? ok(undefined) : fail("not-found", "Material not found.");
}
