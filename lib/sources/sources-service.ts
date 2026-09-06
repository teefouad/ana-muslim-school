import "server-only";

import { bookExists } from "@/lib/books/books-service";
import { isValidDocId } from "@/lib/firestore/is-valid-doc-id";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import {
  createSource as createSourceInRepo,
  deleteSourceById,
  getSourceById as getSourceByIdFromRepo,
  listSources as listSourcesFromRepo,
  updateSourceById,
} from "./sources-repository";
import type { Source } from "./types";
import { parseSourceCreateInput, parseSourcePatchInput } from "./validation";

export async function listSourcesService(): Promise<Source[]> {
  return listSourcesFromRepo();
}

export async function createSourceService(
  body: Record<string, unknown>,
): Promise<ServiceResult<Source>> {
  const parsed = parseSourceCreateInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  if (!(await bookExists(parsed.value.bookId))) {
    return fail(
      "invalid-input",
      "`bookId` does not reference an existing Book.",
    );
  }

  const source = await createSourceInRepo(parsed.value);

  return ok(source);
}

export async function getSourceByIdService(
  id: string,
): Promise<ServiceResult<Source>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid source id.");
  }

  const source = await getSourceByIdFromRepo(id);

  return source ? ok(source) : fail("not-found", "Source not found.");
}

export async function updateSourceService(
  id: string,
  body: Record<string, unknown>,
): Promise<ServiceResult<Source>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid source id.");
  }

  const parsed = parseSourcePatchInput(body);

  if (!parsed.ok) {
    return fail("invalid-input", parsed.message);
  }

  if (
    parsed.value.bookId !== undefined &&
    !(await bookExists(parsed.value.bookId))
  ) {
    return fail(
      "invalid-input",
      "`bookId` does not reference an existing Book.",
    );
  }

  const updated = await updateSourceById(id, parsed.value);

  return updated ? ok(updated) : fail("not-found", "Source not found.");
}

export async function deleteSourceService(
  id: string,
): Promise<ServiceResult<void>> {
  if (!isValidDocId(id)) {
    return fail("invalid-input", "Invalid source id.");
  }

  const deleted = await deleteSourceById(id);

  return deleted ? ok(undefined) : fail("not-found", "Source not found.");
}
