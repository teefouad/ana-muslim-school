"use client";

import { useState, type FormEvent } from "react";
import { SimpleGrid, Stack, TextInput } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import { ToggleCard } from "@/components/ui/toggle-card";
import { TranslatableTextArea } from "@/components/ui/translatable-text-area";
import { TranslatableTextInput } from "@/components/ui/translatable-text-input";
import type {
  LanguageOption,
  TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Book, BookWritableFields } from "@/lib/books/types";

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
        <TranslatableTextInput
          label="Title"
          languages={LANGUAGES}
          value={values.title}
          onChange={(title) => setValues((prev) => ({ ...prev, title }))}
        />

        <TranslatableTextInput
          label="Description"
          languages={LANGUAGES}
          value={values.description}
          onChange={(description) =>
            setValues((prev) => ({ ...prev, description }))
          }
        />

        <TranslatableTextArea
          label="Long description"
          languages={LANGUAGES}
          value={values.longDescription}
          onChange={(longDescription) =>
            setValues((prev) => ({ ...prev, longDescription }))
          }
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
            description="App users can't open locked books."
            variant="error"
            checked={values.isLocked}
            onChange={(isLocked) =>
              setValues((prev) => ({ ...prev, isLocked }))
            }
          />
          <ToggleCard
            label="Published"
            description="Only published books are visible in the app."
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
