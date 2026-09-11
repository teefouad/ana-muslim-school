"use client";

import { useState, type FormEvent } from "react";
import { SimpleGrid, Stack, TextInput } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import type {
  LanguageOption,
  TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Book, BookWritableFields } from "@/lib/books/types";
import {
  suggestBookDescription,
  suggestBookLongDescription,
} from "./import-source/ai-assist-client";
import { translateArabicToEnglish } from "./import-source/translate-client";

const LANGUAGES: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const DEFAULT_COLOR = DEFAULT_APPLICATION_COLOR;

export interface BookFormValues {
  title: TranslatedValue;
  description: TranslatedValue;
  longDescription: TranslatedValue;
  imageId: string;
  isLocked: boolean;
  isPublished: boolean;
  color: string;
}

export function createEmptyBookFormValues(): BookFormValues {
  return {
    title: {},
    description: {},
    longDescription: {},
    imageId: "",
    isLocked: false,
    isPublished: false,
    color: DEFAULT_COLOR,
  };
}

/** Maps a `Book` returned by `GET /api/v1/books/{bookId}` to this form's controlled state. */
export function toBookFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    description: book.description,
    longDescription: book.longDescription,
    imageId: book.imageId,
    isLocked: book.isLocked,
    isPublished: book.isPublished,
    color: book.color,
  };
}

function toTranslatableString(value: TranslatedValue): {
  ar: string;
  en: string;
} {
  return { ar: value.ar ?? "", en: value.en ?? "" };
}

/**
 * Builds a `POST`/`PATCH` `/api/v1/books` request body from this form's
 * values. Field-by-field on purpose -- `modules` and audit/timestamp fields,
 * which this form never edits, can't accidentally leak into a request this
 * way, and each translatable field is normalized to the `{ ar, en }` shape
 * the API requires even before both languages have been filled in.
 */
export function toBookWritableFields(
  values: BookFormValues,
): BookWritableFields {
  return {
    title: toTranslatableString(values.title),
    description: toTranslatableString(values.description),
    longDescription: toTranslatableString(values.longDescription),
    color: values.color,
    imageId: values.imageId,
    isLocked: values.isLocked,
    isPublished: values.isPublished,
  };
}

// Shared Add/Edit form for the Books CRUD UI (ANA-60). Purely a controlled
// field group -- it carries no Firestore/API/router logic, page-level
// navigation, or submit button of its own (ANA-61): callers render their own
// header action(s) and submit this form via the HTML `form` attribute
// pointing at `id`, so there is exactly one submit path instead of a
// duplicated one at the bottom of the form.
export function BookForm({
  id,
  initialValues,
  onSubmit,
}: {
  /** Form element id. Callers wire a header submit button to this form via
   * `<button type="submit" form={id}>` -- normal HTML form semantics, no
   * ref/imperative submit call needed. */
  id: string;
  initialValues?: BookFormValues;
  onSubmit: (values: BookFormValues) => void;
}) {
  const [values, setValues] = useState<BookFormValues>(
    initialValues ?? createEmptyBookFormValues(),
  );

  // While any field's own AI action is in flight, its response can still
  // land and overwrite that field at any moment -- disabling every field
  // (not just the field the AI action targets) for that whole window
  // matches Edit Module's identical `aiBusy` pattern (ANA-94/ANA-100).
  // Each FormField reports its own busy window via `onBusyChange`
  // (ANA-97) rather than this component tracking loading state itself.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [longDescriptionBusy, setLongDescriptionBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy || longDescriptionBusy;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form id={id} onSubmit={handleSubmit}>
      <Stack gap="lg">
        {/* Title (ANA-100): Translate with AI only -- no AI Assistance, per
            the card. */}
        <FormField
          label="Title"
          translatable
          languages={LANGUAGES}
          value={values.title}
          onChange={(title) => setValues((prev) => ({ ...prev, title }))}
          disabled={aiBusy}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          onBusyChange={setTitleBusy}
        />

        {/* Description (ANA-100): Translate with AI and AI Assistance, the
            latter grounded in this Book's own Arabic Title and Long
            Description (see suggest-book-description.ts's base prompt) --
            this Book's own fields are trusted directly, never reloaded
            server-side, so this works identically before the Book is ever
            created. */}
        <FormField
          label="Description"
          translatable
          languages={LANGUAGES}
          value={values.description}
          onChange={(description) =>
            setValues((prev) => ({ ...prev, description }))
          }
          disabled={aiBusy}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, instructions, context }) =>
            suggestBookDescription({
              text,
              additionalInstructions: instructions,
              ...context,
            })
          }
          getAIAssistanceContext={() => ({
            bookTitle: values.title.ar ?? "",
            bookLongDescription: values.longDescription.ar ?? "",
          })}
          onBusyChange={setDescriptionBusy}
        />

        {/* Long description (ANA-100): Translate with AI and AI Assistance,
            the latter grounded in this Book's own Arabic Title and
            (short) Description (see suggest-book-long-description.ts's
            base prompt). */}
        <FormField
          label="Long description"
          type="markdown"
          translatable
          languages={LANGUAGES}
          value={values.longDescription}
          onChange={(longDescription) =>
            setValues((prev) => ({ ...prev, longDescription }))
          }
          disabled={aiBusy}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, instructions, context }) =>
            suggestBookLongDescription({
              text,
              additionalInstructions: instructions,
              ...context,
            })
          }
          getAIAssistanceContext={() => ({
            bookTitle: values.title.ar ?? "",
            bookDescription: values.description.ar ?? "",
          })}
          onBusyChange={setLongDescriptionBusy}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="In-app image ID"
            value={values.imageId}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                imageId: event.currentTarget.value,
              }))
            }
            disabled={aiBusy}
          />

          <ColorField
            value={values.color}
            onChange={(color) => setValues((prev) => ({ ...prev, color }))}
            disabled={aiBusy}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ToggleCard
            label="Locked"
            description="App users can't open locked books."
            variant="error"
            checked={values.isLocked}
            onChange={(isLocked) =>
              setValues((prev) => ({ ...prev, isLocked }))
            }
            disabled={aiBusy}
          />
          <ToggleCard
            label="Published"
            description="Only published books are visible in the app."
            variant="primary"
            checked={values.isPublished}
            onChange={(isPublished) =>
              setValues((prev) => ({ ...prev, isPublished }))
            }
            disabled={aiBusy}
          />
        </SimpleGrid>
      </Stack>
    </form>
  );
}
