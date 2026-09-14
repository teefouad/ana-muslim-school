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
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
        />

        {/* Description (ANA-100): Translate with AI and AI Assistance, the
            latter grounded in this Book's own Title and Long Description
            (see suggest-book-description.ts's base prompt) -- this Book's
            own fields are trusted directly, never reloaded server-side, so
            this works identically before the Book is ever created.
            AI Assistance operates on whichever language tab is active
            (PR review) -- `language` picks which language's Title/Long
            Description context is sent and which language the AI must
            write its result in, so switching to the English tab never
            has AI Assistance write Arabic into the English value. */}
        <FormField
          label="Description"
          translatable
          languages={LANGUAGES}
          value={values.description}
          onChange={(description) =>
            setValues((prev) => ({ ...prev, description }))
          }
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, language, instructions }) => {
            const lang = language === "en" ? "en" : "ar";
            return suggestBookDescription({
              text,
              language: lang,
              additionalInstructions: instructions,
              bookTitle: values.title[lang] ?? "",
              bookLongDescription: values.longDescription[lang] ?? "",
            });
          }}
        />

        {/* Long description (ANA-100): Translate with AI and AI Assistance,
            the latter grounded in this Book's own Title and (short)
            Description (see suggest-book-long-description.ts's base
            prompt) -- same active-language handling as Description above
            (PR review). */}
        <FormField
          label="Long description"
          type="markdown"
          translatable
          languages={LANGUAGES}
          value={values.longDescription}
          onChange={(longDescription) =>
            setValues((prev) => ({ ...prev, longDescription }))
          }
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          onAiAssist={({ text, language, instructions }) => {
            const lang = language === "en" ? "en" : "ar";
            return suggestBookLongDescription({
              text,
              language: lang,
              additionalInstructions: instructions,
              bookTitle: values.title[lang] ?? "",
              bookDescription: values.description[lang] ?? "",
            });
          }}
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
          />

          <ColorField
            value={values.color}
            onChange={(color) => setValues((prev) => ({ ...prev, color }))}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ToggleCard
            label="Locked"
            variant="error"
            checked={values.isLocked}
            onChange={(isLocked) =>
              setValues((prev) => ({ ...prev, isLocked }))
            }
          />
          <ToggleCard
            label="Published"
            variant="primary"
            checked={values.isPublished}
            onChange={(isPublished) =>
              setValues((prev) => ({ ...prev, isPublished }))
            }
          />
        </SimpleGrid>
      </Stack>
    </form>
  );
}
