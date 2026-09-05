"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  ColorInput,
  Group,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";

import { ToggleCard } from "@/components/ui/toggle-card";
import { TranslatableTextArea } from "@/components/ui/translatable-text-area";
import { TranslatableTextInput } from "@/components/ui/translatable-text-input";
import type {
  LanguageOption,
  TranslatedValue,
} from "@/components/ui/translatable-value";
import type { MockBook } from "./mock-books";

const LANGUAGES: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

const DEFAULT_COLOR = "#1c7ed6";

export interface BookFormValues {
  title: TranslatedValue;
  description: TranslatedValue;
  imageId: string;
  locked: boolean;
  published: boolean;
  color: string;
}

export function createEmptyBookFormValues(): BookFormValues {
  return {
    title: {},
    description: {},
    imageId: "",
    locked: false,
    published: false,
    color: DEFAULT_COLOR,
  };
}

export function toBookFormValues(book: MockBook): BookFormValues {
  return {
    title: book.title,
    description: book.description,
    imageId: book.imageId,
    locked: book.locked,
    published: book.published,
    color: book.color,
  };
}

// Shared Add/Edit form for the Books CRUD UI (ANA-60). Purely a controlled
// field group -- it carries no Firestore/API/router logic of its own, so
// callers (the Add Book and Edit Book pages) own what onSubmit does with the
// values and Storybook can render it with no surrounding provider.
export function BookForm({
  initialValues,
  submitLabel = "Add book",
  onSubmit,
  onCancel,
}: {
  initialValues?: BookFormValues;
  submitLabel?: string;
  onSubmit: (values: BookFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<BookFormValues>(
    initialValues ?? createEmptyBookFormValues(),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <TranslatableTextInput
          label="Title"
          languages={LANGUAGES}
          value={values.title}
          onChange={(title) => setValues((prev) => ({ ...prev, title }))}
        />

        <TranslatableTextArea
          label="Description"
          languages={LANGUAGES}
          value={values.description}
          onChange={(description) =>
            setValues((prev) => ({ ...prev, description }))
          }
        />

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

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <ToggleCard
            label="Locked"
            description="Locked books can't be opened by users until unlocked."
            variant="error"
            checked={values.locked}
            onChange={(locked) => setValues((prev) => ({ ...prev, locked }))}
          />
          <ToggleCard
            label="Published"
            description="Only published books are visible in the app."
            variant="primary"
            checked={values.published}
            onChange={(published) =>
              setValues((prev) => ({ ...prev, published }))
            }
          />
          <ColorInput
            label="Color"
            value={values.color}
            onChange={(color) => setValues((prev) => ({ ...prev, color }))}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
