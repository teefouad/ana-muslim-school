import "server-only";

import { getBookByIdService } from "@/lib/books/books-service";
import {
  parseTranslatableString,
  type TranslatableString,
} from "@/lib/learning-content/translatable-string";
import { fail, ok, type ServiceResult } from "@/lib/http/service-result";
import { AiTaskError } from "./run-ai-task";
import {
  translateModuleField,
  type TranslatableModuleField,
} from "./translate-module-field";

const FIELDS: readonly TranslatableModuleField[] = [
  "title",
  "description",
  "content",
];

/** Parses an optional `{ ar, en }` request field -- `undefined` when the
 * caller omitted it (a valid, common case: not every sibling Module field
 * is filled in yet), `{ ok: false }` when it was supplied but isn't a
 * valid `TranslatableString`. */
function readOptionalTranslatable(
  value: unknown,
): { ok: true; value?: TranslatableString } | { ok: false } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  const parsed = parseTranslatableString(value);

  return parsed ? { ok: true, value: parsed } : { ok: false };
}

/**
 * Validates and runs a context-aware Module field translation for
 * `POST /api/v1/ai/translate` (`field` set, ANA-98) -- unlike the plain,
 * context-free `translateArabicToEnglishService`, this loads the owning
 * Book server-side from a client-supplied `bookId` and accepts this same
 * Module's other, already-filled-in fields (`moduleTitle`/
 * `moduleDescription`/`moduleContent`, all optional) as orientation
 * context, so the translation preserves the meaning appropriate to the
 * target field and its Book/Module context rather than translating an
 * isolated string.
 */
export async function translateModuleFieldService(
  body: Record<string, unknown>,
): Promise<ServiceResult<{ text: string }>> {
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return fail("invalid-input", "`text` must be a non-empty string.");
  }

  if (
    typeof body.field !== "string" ||
    !FIELDS.includes(body.field as TranslatableModuleField)
  ) {
    return fail(
      "invalid-input",
      '`field` must be "title", "description", or "content".',
    );
  }

  if (typeof body.bookId !== "string" || body.bookId.trim().length === 0) {
    return fail("invalid-input", "`bookId` must be a non-empty string.");
  }

  const moduleTitle = readOptionalTranslatable(body.moduleTitle);
  if (!moduleTitle.ok) {
    return fail(
      "invalid-input",
      "`moduleTitle` must be a `{ ar, en }` object.",
    );
  }

  const moduleDescription = readOptionalTranslatable(body.moduleDescription);
  if (!moduleDescription.ok) {
    return fail(
      "invalid-input",
      "`moduleDescription` must be a `{ ar, en }` object.",
    );
  }

  const moduleContent = readOptionalTranslatable(body.moduleContent);
  if (!moduleContent.ok) {
    return fail(
      "invalid-input",
      "`moduleContent` must be a `{ ar, en }` object.",
    );
  }

  const additionalInstructions =
    typeof body.additionalInstructions === "string"
      ? body.additionalInstructions.trim() || undefined
      : undefined;

  const field = body.field as TranslatableModuleField;
  const bookResult = await getBookByIdService(body.bookId);

  if (!bookResult.ok) {
    return bookResult;
  }

  try {
    const text = await translateModuleField(
      body.text,
      field,
      {
        title: bookResult.value.title,
        description: bookResult.value.description,
        longDescription: bookResult.value.longDescription,
      },
      {
        title: moduleTitle.value,
        description: moduleDescription.value,
        content: moduleContent.value,
      },
      additionalInstructions,
    );

    return ok({ text });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return fail("upstream-error", "Translation failed. Please try again.");
    }

    throw error;
  }
}
