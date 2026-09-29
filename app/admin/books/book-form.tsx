"use client";

import { useState, type FormEvent } from "react";
import { SimpleGrid, Stack, TextInput } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import { FormField } from "@/components/ui/form-field";
import { ToggleCard } from "@/components/ui/toggle-card";
import {
  isSameTranslatedValue,
  type LanguageOption,
  type TranslatedValue,
} from "@/components/ui/translatable-value";
import type { Book, BookWritableFields } from "@/lib/books/types";
import {
  suggestBookDescription,
  suggestBookLongDescription,
  toFieldValue,
} from "./import-source/ai-assist-client";
import { translateArabicToEnglish } from "./import-source/translate-client";
import { BookModulePicker, type BookModuleOption } from "./book-module-picker";
import { toTranslatableString } from "./module-fields";

function bilingualValue(value: TranslatedValue) {
  return { ar: value.ar ?? "", en: value.en ?? "" };
}

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

function isSameBookFormValues(a: BookFormValues, b: BookFormValues): boolean {
  return (
    isSameTranslatedValue(a.title, b.title) &&
    isSameTranslatedValue(a.description, b.description) &&
    isSameTranslatedValue(a.longDescription, b.longDescription) &&
    a.imageId === b.imageId &&
    a.isLocked === b.isLocked &&
    a.isPublished === b.isPublished &&
    a.color === b.color
  );
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
  onDirtyChange,
  bookId,
  modules,
}: {
  /** The persisted Book's id and its Modules (ANA-133) -- when both are
   * given, the Description/Long description AI dialogs offer a module
   * picker whose selected Modules ground the generated text. Omitted on
   * Add Book, where there are no persisted Modules yet. */
  bookId?: string;
  modules?: BookModuleOption[];
  /** Form element id. Callers wire a header submit button to this form via
   * `<button type="submit" form={id}>` -- normal HTML form semantics, no
   * ref/imperative submit call needed. */
  id: string;
  initialValues?: BookFormValues;
  /** Awaited (ANA-129 PR review): resolving means the save succeeded, and
   * this form resets its own `baseline` to the just-submitted `values` so
   * Save changes reflects back to clean -- this form is never unmounted or
   * re-seeded by the caller on save (unlike `ModuleEditorBody`'s own
   * create-mode remount), so nothing else would otherwise clear its dirty
   * state. Rejecting leaves the draft (and its dirty state) exactly as the
   * user left it, so a failed save never looks like it succeeded; the
   * caller owns surfacing the actual error. */
  onSubmit: (values: BookFormValues) => Promise<void>;
  /** Reports whether the current draft has diverged from `initialValues`
   * (ANA-129) -- the caller's own Save changes button (rendered outside
   * this form, see this file's own top-level doc) uses it to reflect
   * unsaved changes. Called directly from each field's own `onChange`
   * (`updateValues` below), never from an effect: this form owns the
   * values, and the caller only ever needs to know when they change, not
   * to resync anything of its own on mount. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState<BookFormValues>(
    initialValues ?? createEmptyBookFormValues(),
  );
  // Pinned to this form's own first-render values (a lazy `useState`
  // initializer only ever runs once, on mount) -- the same baseline
  // `values` itself was already seeded from, so dirty-checking stays
  // correct for this editing session even if the caller's own
  // `initialValues` object identity changes later (e.g. a background SWR
  // revalidation of the same Book), the same "seed once, don't resync a
  // later prop change" contract `values`' own initial state already has.
  // `useState`, not `useRef` -- this value is read directly in `isDirty`-
  // style render-time computations elsewhere in this file (`updateValues`
  // below), and this project's `react-hooks/refs` lint rule flags a ref's
  // `.current` read that way (permission-form.tsx hit this identically).
  // Reset directly to the just-saved `values` on a successful submit
  // (`handleSubmit` below, ANA-129 PR review) -- unlike `values`' own
  // initial state, this one *does* get updated after mount, exactly once
  // per successful save, which is what "seed once" was guarding against a
  // stray background revalidation doing instead.
  const [baseline, setBaseline] = useState(values);
  // Modules picked as AI context, one selection per field (ANA-133) --
  // deliberately not part of `values`, so choosing context never marks the
  // form dirty. Filtered against the current `modules` when used, so a
  // Module deleted since it was ticked is never sent.
  const [descriptionModuleIds, setDescriptionModuleIds] = useState<string[]>(
    [],
  );
  const [longDescriptionModuleIds, setLongDescriptionModuleIds] = useState<
    string[]
  >([]);
  const hasModulePicker = bookId !== undefined && modules !== undefined;

  function selectedModules(ids: string[]) {
    if (!hasModulePicker) return {};
    const valid = ids.filter((id) => modules.some((m) => m.id === id));
    return valid.length ? { bookId, moduleIds: valid } : {};
  }

  function updateValues(patch: Partial<BookFormValues>) {
    const next = { ...values, ...patch };
    setValues(next);
    onDirtyChange?.(!isSameBookFormValues(next, baseline));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onSubmit(values);
      setBaseline(values);
      onDirtyChange?.(false);
    } catch {
      // The caller (`[id]/edit/page.tsx`) already surfaces its own error
      // state -- this form just leaves the draft (and its dirty state)
      // exactly as the user left it, so a failed save never looks saved.
    }
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
          onChange={(title) => updateValues({ title })}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
        />

        {/* Description (ANA-100): Translate with AI and AI Assistance, the
            latter grounded in this Book's own Title and Long Description
            (see suggest-book-description.ts's base prompt) -- this Book's
            own fields are trusted directly, never reloaded server-side, so
            this works identically before the Book is ever created.
            AI Assistance sends both languages' current values and returns
            both a fresh Arabic and English description (ANA-135); an
            existing English value is only overwritten after FormField's
            confirmation. */}
        <FormField
          label="Description"
          translatable
          languages={LANGUAGES}
          value={values.description}
          onChange={(description) => updateValues({ description })}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          aiAssistanceOptions={
            hasModulePicker ? (
              <BookModulePicker
                modules={modules}
                value={descriptionModuleIds}
                onChange={setDescriptionModuleIds}
              />
            ) : undefined
          }
          onAiAssist={async ({ instructions }) =>
            toFieldValue(
              await suggestBookDescription({
                text: bilingualValue(values.description),
                additionalInstructions: instructions,
                bookTitle: bilingualValue(values.title),
                bookLongDescription: bilingualValue(values.longDescription),
                ...selectedModules(descriptionModuleIds),
              }),
            )
          }
        />

        {/* Long description (ANA-100): Translate with AI and AI Assistance,
            the latter grounded in this Book's own Title and (short)
            Description (see suggest-book-long-description.ts's base
            prompt) -- same bilingual handling as Description above
            (PR review). */}
        <FormField
          label="Long description"
          type="markdown"
          translatable
          languages={LANGUAGES}
          value={values.longDescription}
          onChange={(longDescription) => updateValues({ longDescription })}
          aiTranslation
          onAiTranslate={({ text }) => translateArabicToEnglish(text)}
          aiAssistance
          aiAssistanceOptions={
            hasModulePicker ? (
              <BookModulePicker
                modules={modules}
                value={longDescriptionModuleIds}
                onChange={setLongDescriptionModuleIds}
              />
            ) : undefined
          }
          onAiAssist={async ({ instructions }) =>
            toFieldValue(
              await suggestBookLongDescription({
                text: bilingualValue(values.longDescription),
                additionalInstructions: instructions,
                bookTitle: bilingualValue(values.title),
                bookDescription: bilingualValue(values.description),
                ...selectedModules(longDescriptionModuleIds),
              }),
            )
          }
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="In-app image ID"
            value={values.imageId}
            onChange={(event) =>
              updateValues({ imageId: event.currentTarget.value })
            }
          />

          <ColorField
            value={values.color}
            onChange={(color) => updateValues({ color })}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ToggleCard
            label="Locked"
            variant="error"
            checked={values.isLocked}
            onChange={(isLocked) => updateValues({ isLocked })}
          />
          <ToggleCard
            label="Published"
            variant="primary"
            checked={values.isPublished}
            onChange={(isPublished) => updateValues({ isPublished })}
          />
        </SimpleGrid>
      </Stack>
    </form>
  );
}
