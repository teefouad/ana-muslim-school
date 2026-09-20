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

export interface SuggestLessonFieldInput {
  text: string;
  additionalInstructions?: string;
  /** The owning Module's own current Arabic Title/Description/Learning
   * Material (ANA-116) -- always this Module's *current* editor values,
   * including any unsaved edits still held in the Edit Module modal's own
   * state, never a fresh server reload (the server trusts these directly,
   * exactly like a Book's own fields for Book-level AI Assistance). */
  moduleTitle: string;
  moduleDescription: string;
  moduleContent: string;
}

/** Suggests or improves a Lesson's Title via `POST /api/v1/ai/assist`
 * (`field: "lessonTitle"`, ANA-116) -- unlike Module-level AI Assistance,
 * this never sends a `bookId`/Module id for the server to reload from: the
 * owning Module's context is sent directly, the same way a Book's own
 * fields are sent directly for Book-level AI Assistance. Returns only the
 * suggested title text -- callers apply it to their own Title draft. */
export async function suggestLessonTitle({
  text,
  additionalInstructions,
  moduleTitle,
  moduleDescription,
  moduleContent,
}: SuggestLessonFieldInput): Promise<string> {
  return requestAssist({
    field: "lessonTitle",
    text,
    additionalInstructions,
    moduleTitle,
    moduleDescription,
    moduleContent,
  });
}

/** Suggests or improves a Lesson's One-line description via
 * `POST /api/v1/ai/assist` (`field: "lessonDescription"`, ANA-116) -- see
 * `suggestLessonTitle` for why this never sends a `bookId`/Module id
 * either. Returns only the suggested description text -- callers apply it
 * to their own Description draft. */
export async function suggestLessonDescription({
  text,
  additionalInstructions,
  moduleTitle,
  moduleDescription,
  moduleContent,
}: SuggestLessonFieldInput): Promise<string> {
  return requestAssist({
    field: "lessonDescription",
    text,
    additionalInstructions,
    moduleTitle,
    moduleDescription,
    moduleContent,
  });
}

/** The language of the Book field actually being written -- whichever
 * language tab is active in `FormField` (ANA-100, PR review). AI
 * Assistance always writes its result back to this same language, so this
 * is never inferred from the Book's own Arabic/English content; it's the
 * active tab at the moment the action was triggered. */
type BookFieldLanguage = "ar" | "en";

export interface SuggestBookDescriptionInput {
  text: string;
  language: BookFieldLanguage;
  additionalInstructions?: string;
  /** The Book's own Title/Long Description, in the same `language` as the
   * Description being written (ANA-100, PR review) -- the Book being
   * edited is trusted directly from the caller, not reloaded server-side,
   * since a Book being created has no persisted id yet to reload from. */
  bookTitle: string;
  bookLongDescription: string;
}

/** Suggests or improves a Book's Description via `POST /api/v1/ai/assist`
 * (`field: "bookDescription"`, ANA-100) -- unlike the Module-level assist
 * functions above, this never sends a `bookId`: a Book's own fields are
 * always this same Book, so its context is sent directly, not reloaded
 * server-side. Returns only the suggested description text, in `language`
 * -- callers apply it to their own Description draft, in that same
 * language. */
export async function suggestBookDescription({
  text,
  language,
  additionalInstructions,
  bookTitle,
  bookLongDescription,
}: SuggestBookDescriptionInput): Promise<string> {
  return requestAssist({
    field: "bookDescription",
    text,
    language,
    additionalInstructions,
    bookTitle,
    bookLongDescription,
  });
}

export interface SuggestBookLongDescriptionInput {
  text: string;
  language: BookFieldLanguage;
  additionalInstructions?: string;
  /** The Book's own Title/Description, in the same `language` as the Long
   * Description being written (ANA-100, PR review) -- see
   * `SuggestBookDescriptionInput` for why this is sent directly rather
   * than reloaded server-side. */
  bookTitle: string;
  bookDescription: string;
}

/** Suggests or improves a Book's Long Description via
 * `POST /api/v1/ai/assist` (`field: "bookLongDescription"`, ANA-100) --
 * see `suggestBookDescription` for why this never sends a `bookId`.
 * Returns only the suggested long description text, in `language` --
 * callers apply it to their own Long Description draft, in that same
 * language. */
export async function suggestBookLongDescription({
  text,
  language,
  additionalInstructions,
  bookTitle,
  bookDescription,
}: SuggestBookLongDescriptionInput): Promise<string> {
  return requestAssist({
    field: "bookLongDescription",
    text,
    language,
    additionalInstructions,
    bookTitle,
    bookDescription,
  });
}
