import {
  isSameTranslatedValue,
  type TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Question, QuestionWritableFields } from "@/lib/questions/types";
import { toTranslatableString } from "./module-fields";
import {
  parseQuestionText,
  serializeQuestionText,
  type ParsedQuestionText,
} from "./question-text-format";

/** One choice as edited in the Question editor (ANA-119) -- the same shape
 * as the persisted `QuestionChoice`, just with the UI's looser
 * `TranslatedValue` (an absent language slot rather than a required empty
 * string) for `text`. */
interface QuestionChoiceFieldValue {
  text: TranslatedValue;
  isCorrect: boolean;
}

/** One Question as edited in the Lesson editor's Questions list (ANA-119).
 * `key` is a client-only, locally-generated id (never persisted) that keeps
 * this entry's identity stable across reorders/collapse state/edits within
 * one editing session -- the same role `LessonAzkarFieldEntry.id` plays for
 * Break entries (lesson-fields.ts). `id` is the linked, book-scoped
 * Question document's id, or `null` for a brand-new local draft that has
 * never been persisted.
 *
 * `text`/`explanation`/`choices` only ever advance to match a *successful*
 * parse of `rawText` (see question-text-editor.tsx/applyParsedQuestionText
 * below); a currently-invalid `rawText` buffer never discards, normalizes,
 * or replaces them. `rawText` is deliberately excluded from
 * `toQuestionWritableFields` (the server payload) -- the persisted Question
 * model never gains a `rawText` field, only these structured fields.
 *
 * `sourceModuleId`/`sourceQuestionId` (ANA-120) are set only for a draft
 * copied from a *previous* Module via Insert (see
 * `copyQuestionFromPreviousModule` below) -- the School schema requires
 * `Lesson.questions` ids to resolve under the Lesson's own Module, so a
 * previous-Module Question can never be referenced directly and is instead
 * copied in as a brand-new, unpersisted draft (`id: null`) for the current
 * Module. These two fields exist purely to keep enough client-side source
 * identity to stop the *same* previous-Module Question from being inserted
 * twice into one Lesson draft (questions-editor.tsx's own exclusion check) --
 * they're deliberately excluded from `toQuestionWritableFields` alongside
 * `key`/`rawText`, so this source identity never reaches the canonical
 * Question document. */
export interface QuestionFieldEntry {
  key: string;
  id: string | null;
  text: TranslatedValue;
  explanation: TranslatedValue;
  choices: QuestionChoiceFieldValue[];
  rawText: TranslatedValue;
  sourceModuleId?: string;
  sourceQuestionId?: string;
}

/** Every Question currently defined for one Module, as returned by the
 * Book-wide `GET /api/v1/books/{bookId}/questions` endpoint (ANA-108),
 * grouped and ordered per `Book.modules` -- the read boundary Insert's
 * Question Bank picker uses for every Module *before* the Lesson's own
 * (ANA-120). */
export interface ModuleQuestionGroup {
  moduleId: string;
  questions: Question[];
}

function makeKey(): string {
  return crypto.randomUUID();
}

/** A brand-new, blank local Question draft (ANA-119's New action) -- ready
 * to edit immediately, not persisted until the Lesson itself is saved. */
export function makeQuestionFieldEntry(): QuestionFieldEntry {
  return {
    key: makeKey(),
    id: null,
    text: {},
    explanation: {},
    choices: [],
    rawText: {},
  };
}

function rawTextFromContent(
  text: TranslatedValue,
  explanation: TranslatedValue,
  choices: QuestionChoiceFieldValue[],
): TranslatedValue {
  return {
    ar: serializeQuestionText({
      text: text.ar ?? "",
      explanation: explanation.ar ?? "",
      choices: choices.map((choice) => ({
        text: choice.text.ar ?? "",
        isCorrect: choice.isCorrect,
      })),
    }),
    en: serializeQuestionText({
      text: text.en ?? "",
      explanation: explanation.en ?? "",
      choices: choices.map((choice) => ({
        text: choice.text.en ?? "",
        isCorrect: choice.isCorrect,
      })),
    }),
  };
}

function buildQuestionFieldEntry(
  question: Question,
  id: string | null,
  source?: { moduleId: string; questionId: string },
): QuestionFieldEntry {
  const choices: QuestionChoiceFieldValue[] = question.choices.map(
    (choice) => ({ text: { ...choice.text }, isCorrect: choice.isCorrect }),
  );

  return {
    key: makeKey(),
    id,
    text: { ...question.text },
    explanation: { ...question.explanation },
    choices,
    rawText: rawTextFromContent(question.text, question.explanation, choices),
    sourceModuleId: source?.moduleId,
    sourceQuestionId: source?.questionId,
  };
}

/** Seeds a Question editor entry from a real, API-backed Question --
 * `rawText` is derived from its current structured content so it opens
 * pre-formatted in the structured editor. Used both to hydrate an existing
 * Lesson's own Questions (lesson-fields.ts) and to Insert an existing
 * *current*-Module Question (questions-editor.tsx, ANA-120), both of which
 * reuse the real Question id as-is. */
export function toQuestionFieldEntry(question: Question): QuestionFieldEntry {
  return buildQuestionFieldEntry(question, question.id);
}

/** Copies a *previous*-Module Question into a brand-new, unpersisted draft
 * for the current Module (Insert, ANA-120) -- `id: null`, exactly like a
 * blank New entry, so the existing Save flow (`saveLessonQuestions`) creates
 * it under the current Module the same way it already creates any other new
 * draft, with the same retry-safe idempotency (ANA-119 PR review). The
 * source Question/Module are never mutated; only their current content is
 * copied. See `QuestionFieldEntry`'s own doc on why `sourceModuleId`/
 * `sourceQuestionId` are attached here. */
export function copyQuestionFromPreviousModule(
  question: Question,
  moduleId: string,
): QuestionFieldEntry {
  return buildQuestionFieldEntry(question, null, {
    moduleId,
    questionId: question.id,
  });
}

/** Seeds a Question editor entry from one AI-generated question (ANA-131) --
 * Arabic-only, matching this Admin's "Arabic first, Translate afterwards"
 * pattern every other Question draft already follows (see
 * `useTranslateQuestion`); the English side starts blank and is filled in by
 * the existing Translate action, never by generation itself. `id: null`,
 * exactly like a blank New entry, so the existing Save flow persists it the
 * same way any other new draft is persisted. */
export function fromGeneratedQuestion(generated: {
  text: string;
  explanation: string;
  choices: { text: string; isCorrect: boolean }[];
}): QuestionFieldEntry {
  const text: TranslatedValue = { ar: generated.text };
  const explanation: TranslatedValue = { ar: generated.explanation };
  const choices: QuestionChoiceFieldValue[] = generated.choices.map(
    (choice) => ({
      text: { ar: choice.text },
      isCorrect: choice.isCorrect,
    }),
  );

  return {
    key: makeKey(),
    id: null,
    text,
    explanation,
    choices,
    rawText: rawTextFromContent(text, explanation, choices),
  };
}

/** Applies a *successful* parse of one language's raw textarea buffer onto
 * an entry (see question-text-editor.tsx) -- the parsed line order/
 * correctness becomes authoritative for `choices` (there's only ever one
 * shared, non-translatable `isCorrect`/order per choice, not one per
 * language), while each choice's *other* language text is preserved by
 * matching position against the entry's existing choices; a position with
 * no existing choice yet starts blank in the other language. Never called
 * for a failed parse -- the caller keeps `text`/`explanation`/`choices`
 * exactly as they were instead. */
export function applyParsedQuestionText(
  entry: QuestionFieldEntry,
  lang: "ar" | "en",
  parsed: ParsedQuestionText,
): QuestionFieldEntry {
  const choices: QuestionChoiceFieldValue[] = parsed.choices.map(
    (choice, index) => {
      const existing = entry.choices[index];
      return {
        isCorrect: choice.isCorrect,
        text: { ...existing?.text, [lang]: choice.text },
      };
    },
  );

  return {
    ...entry,
    text: { ...entry.text, [lang]: parsed.text },
    explanation: { ...entry.explanation, [lang]: parsed.explanation },
    choices,
  };
}

/** Builds the Question create/patch payload from an entry -- strips the
 * client-only `key`/`id`/`rawText`, never introducing them into the
 * persisted Question document (ANA-119). */
export function toQuestionWritableFields(
  entry: QuestionFieldEntry,
): QuestionWritableFields {
  return {
    text: toTranslatableString(entry.text),
    explanation: toTranslatableString(entry.explanation),
    choices: entry.choices.map((choice) => ({
      text: toTranslatableString(choice.text),
      isCorrect: choice.isCorrect,
    })),
  };
}

/** Compares two Question entry lists by linkage and raw buffer content only
 * (order matters), ignoring each entry's own `key` -- lesson-editor.tsx's
 * own dirty check can't compare `key`s directly, since `toQuestionFieldEntry`
 * mints a fresh one on every call. `rawText` alone is a reliable proxy for
 * "has this entry's content changed": `text`/`explanation`/`choices` only
 * ever advance in lockstep with a successful parse of `rawText`, so any
 * edit -- valid or still-invalid -- always changes `rawText` too. */
export function isSameQuestionEntries(
  a: QuestionFieldEntry[],
  b: QuestionFieldEntry[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.id === b[index].id &&
        isSameTranslatedValue(entry.rawText, b[index].rawText),
    )
  );
}

/** Whether any entry's raw textarea buffer -- in either language -- is
 * currently unparseable (PR review, ANA-119). `QuestionTextEditor`
 * deliberately keeps an invalid `rawText` around without ever reflecting it
 * into `text`/`explanation`/`choices` (see `applyParsedQuestionText`'s own
 * doc), so those structured fields can silently go stale relative to what's
 * actually showing on screen. Save must be blocked while this is true --
 * otherwise `saveLessonQuestions` would serialize the last successfully
 * parsed (possibly blank) content instead of surfacing the parse error,
 * exactly the "admin sees malformed text, clicks Save, it silently
 * persists the wrong value" failure this guards against. Mirrors the old
 * admin's own `hasInvalidQuestionText` check ahead of its Save action. */
export function hasInvalidQuestionText(entries: QuestionFieldEntry[]): boolean {
  return entries.some(
    (entry) =>
      !parseQuestionText(entry.rawText.ar ?? "").ok ||
      !parseQuestionText(entry.rawText.en ?? "").ok,
  );
}
