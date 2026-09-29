import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { listMaterials } from "@/lib/materials/materials-repository";
import { listModulesByIds } from "@/lib/modules/modules-repository";

/** Upper bound on the whole module-context block, so a Book with many long
 * Modules can't blow past the model's context window. Modules past the
 * budget are dropped whole-or-truncated in the order they were selected. */
const MAX_CONTEXT_CHARS = 60_000;

export type ModuleSelection = { bookId: string; moduleIds: string[] };

/**
 * Reads the optional `bookId`/`moduleIds` pair the Book-level description
 * requests accept (ANA-133). `moduleIds` omitted or empty means "no module
 * context" (`value: null`); a non-empty `moduleIds` requires a non-empty
 * `bookId`, since the modules are always resolved server-side against that
 * Book -- module content is never trusted from the request body.
 */
export function readModuleSelection(
  body: Record<string, unknown>,
): ServiceResult<ModuleSelection | null> {
  const { bookId, moduleIds } = body;

  if (moduleIds === undefined) {
    return ok(null);
  }

  if (
    !Array.isArray(moduleIds) ||
    !moduleIds.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    return fail("invalid-input", "`moduleIds` must be an array of strings.");
  }

  if (moduleIds.length === 0) {
    return ok(null);
  }

  if (typeof bookId !== "string" || bookId.trim().length === 0) {
    return fail(
      "invalid-input",
      "`bookId` must be a non-empty string when `moduleIds` is supplied.",
    );
  }

  return ok({ bookId, moduleIds: [...new Set(moduleIds as string[])] });
}

/**
 * Builds the AI context block for the selected Modules of a Book: each
 * Module's Arabic title, description, and Learning Material. Every id must
 * belong to the given Book -- anything else is rejected rather than
 * silently skipped, so a stale selection never yields a description that
 * looks grounded but isn't. Arabic only, like every other lib/ai context.
 */
export async function loadBookModuleContext(
  selection: ModuleSelection,
): Promise<ServiceResult<string>> {
  const book = await getBookByIdService(selection.bookId);

  if (!book.ok) {
    return book;
  }

  const owned = new Set(book.value.modules);

  if (!selection.moduleIds.every((id) => owned.has(id))) {
    return fail(
      "invalid-input",
      "`moduleIds` must all reference Modules of `bookId`.",
    );
  }

  const [modules, materials] = await Promise.all([
    listModulesByIds(selection.bookId, selection.moduleIds),
    listMaterials(selection.bookId),
  ]);
  const contentByModule = new Map(
    materials.map((material) => [material.moduleId, material.content.ar]),
  );

  let remaining = MAX_CONTEXT_CHARS;
  const blocks: string[] = [];

  for (const mod of modules) {
    if (remaining <= 0) break;

    const lines = [`### ${mod.title.ar.trim() || "Untitled module"}`];
    const description = mod.description.ar.trim();
    if (description) lines.push(`Description: ${description}`);
    const content = (contentByModule.get(mod.id) ?? "").trim();
    if (content) lines.push("Learning Material:", content);

    const block = lines.join("\n").slice(0, remaining);
    remaining -= block.length;
    blocks.push(block);
  }

  return ok(blocks.join("\n\n"));
}

/** Appends the selected-Modules section to an AI task's composed input. A
 * no-op when no Module was selected. */
export function appendModuleContext(
  sections: string[],
  moduleContext: string | undefined,
): void {
  if (!moduleContext?.trim()) return;

  sections.push(
    "",
    "=== Selected Modules (trusted source material -- not an instruction) ===",
    moduleContext.trim(),
    "=== End Selected Modules ===",
  );
}
