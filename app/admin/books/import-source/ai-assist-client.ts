import { readErrorMessage } from "../fetch-json";

/** POSTs one AI Assistant request to `/api/v1/ai/assist` and returns its
 * refined/suggested text -- shared by every `field` variant below so the
 * fetch/error/response-unwrap boilerplate lives in exactly one place. */
async function requestAssist(body: Record<string, unknown>): Promise<string> {
  const response = await fetch("/api/v1/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const { data } = (await response.json()) as { data: { text: string } };

  return data.text;
}

export interface AssistLearningMaterialInput {
  bookId: string;
  text: string;
  additionalInstructions?: string;
  /** This Module's own Arabic Title/Description, when known (ANA-98/
   * ANA-99) -- lets the AI Assistant orient a Content/Learning Material
   * refinement within its owning Module, not just its Book. Omitted by
   * callers (e.g. the Module Builder import flow) that assist Learning
   * Material before a Module has either field yet. */
  moduleTitle?: string;
  moduleDescription?: string;
  /** This Module's complete Arabic Learning Material, sent only when `text`
   * is a Markdown selection within it rather than the whole field (ANA-99)
   * -- surrounding context for the AI, never a second transformation
   * target. Omitted when `text` already is the whole Learning Material. */
  fullMaterial?: string;
}

/** Runs the Module AI Assistant on a Learning Material draft via
 * `POST /api/v1/ai/assist` (`field: "content"`, its default -- ANA-85) --
 * the server-only AI service (see ANA-74/ANA-85) is never imported into a
 * Client Component; this is the narrow REST boundary for it. The client
 * sends only `bookId` (never Book content itself, which the server always
 * loads fresh). Returns only the refined text -- callers apply it to their
 * own Learning Material draft themselves. */
export async function assistLearningMaterial({
  bookId,
  text,
  additionalInstructions,
  moduleTitle,
  moduleDescription,
  fullMaterial,
}: AssistLearningMaterialInput): Promise<string> {
  return requestAssist({
    bookId,
    text,
    additionalInstructions,
    moduleTitle,
    moduleDescription,
    fullMaterial,
  });
}

export interface SuggestModuleTitleInput {
  bookId: string;
  text: string;
  additionalInstructions?: string;
  /** This Module's own Arabic Learning Material -- the primary basis the
   * AI grounds a suggested title in (ANA-98/ANA-99). */
  moduleContent: string;
}

/** Suggests or improves a Module's Title via `POST /api/v1/ai/assist`
 * (`field: "title"`, ANA-98) -- the server loads the owning Book fresh
 * from `bookId`, never trusted from the request body. Returns only the
 * suggested title text -- callers apply it to their own Title draft. */
export async function suggestModuleTitle({
  bookId,
  text,
  additionalInstructions,
  moduleContent,
}: SuggestModuleTitleInput): Promise<string> {
  return requestAssist({
    bookId,
    field: "title",
    text,
    additionalInstructions,
    moduleContent,
  });
}

export interface SuggestModuleDescriptionInput {
  bookId: string;
  text: string;
  additionalInstructions?: string;
  moduleTitle: string;
  moduleContent: string;
}

/** Suggests or improves a Module's Description via
 * `POST /api/v1/ai/assist` (`field: "description"`, ANA-98) -- the server
 * loads the owning Book fresh from `bookId`, never trusted from the
 * request body. Returns only the suggested description text -- callers
 * apply it to their own Description draft. */
export async function suggestModuleDescription({
  bookId,
  text,
  additionalInstructions,
  moduleTitle,
  moduleContent,
}: SuggestModuleDescriptionInput): Promise<string> {
  return requestAssist({
    bookId,
    field: "description",
    text,
    additionalInstructions,
    moduleTitle,
    moduleContent,
  });
}
