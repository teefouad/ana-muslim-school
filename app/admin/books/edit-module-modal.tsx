"use client";

import { useState } from "react";
import { Alert, Button, Group, Modal, Stack } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { FormField } from "@/components/ui/form-field";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import type { Book } from "@/lib/books/types";
import {
  assistLearningMaterial,
  suggestModuleDescription,
  suggestModuleTitle,
  type AiAssistLanguage,
} from "./import-source/ai-assist-client";
import { translateModuleField } from "./import-source/translate-client";
import {
  createEmptyModuleFieldsValues,
  toTranslatableString,
  type ModuleFieldsValues,
} from "./module-fields";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** `"create"` opens the modal empty, with Save Module as its primary action
 * (ANA-94) -- clicking Add Module no longer inserts anything into the
 * Module list itself; that only happens once this modal's own backend
 * create request succeeds (see `[id]/edit/page.tsx`'s `handleCreateModule`).
 * `"edit"` seeds it from an existing, real Module's current fields, primary
 * action Save changes -- unchanged from ANA-91 except that saving now
 * persists through the backend instead of only updating local state. */
export type EditModuleModalState =
  { mode: "create" } | { mode: "edit"; id: string; fields: ModuleFieldsValues };

export interface EditModuleModalProps {
  /** `null` closes the modal. */
  state: EditModuleModalState | null;
  /** The owning Book -- its `id` is what every AI action here sends as
   * `bookId` (the server always reloads the Book fresh from it for its own
   * Book-level context, never trusting client-sent Book fields, ANA-85),
   * and its Title/Description/Long description are read directly by this
   * modal's own AI context builders (ANA-98) -- the Edit Book page already
   * has the full `Book` loaded, so this needs no second fetch. */
  book: Book;
  onClose: () => void;
  /** Called with the modal's current field values when Save Module is
   * clicked in create mode. The modal awaits this -- resolving creates the
   * Module through the backend and closes the modal; rejecting keeps the
   * modal open and shows the error, without ever calling `onClose` itself
   * (ANA-94: "only add the Module to the list after creation succeeds"). */
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  /** Called with the modal's current field values when Save changes is
   * clicked in edit mode. Same awaited resolve/reject contract as
   * `onCreate`. */
  onSave: (id: string, fields: ModuleFieldsValues) => Promise<void>;
}

// Top-level modal (ANA-91) opened from the Edit Book screen's Modules panel
// -- deliberately a sibling of, not nested inside, the Module Builder modal
// (ImportSourceModal). Reused for both Add Module (create mode) and the
// pencil action (edit mode) rather than duplicating the form (ANA-94) --
// only the title, primary action label, and which callback Save invokes
// differ between the two.
export function EditModuleModal({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: EditModuleModalProps) {
  return (
    <Modal
      opened={state !== null}
      onClose={onClose}
      title={state?.mode === "create" ? "Add Module" : "Edit Module"}
      size="lg"
      centered
    >
      {state && (
        <EditModuleModalBody
          // Remounts (a fresh local draft) per distinct edit target, and
          // whenever create mode is (re-)entered after a different state --
          // matching BookForm/DeleteConfirmModal's own "T | null as the open
          // signal" pattern.
          key={state.mode === "create" ? "create" : state.id}
          state={state}
          book={book}
          onClose={onClose}
          onCreate={onCreate}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function EditModuleModalBody({
  state,
  book,
  onClose,
  onCreate,
  onSave,
}: {
  state: EditModuleModalState;
  book: Book;
  onClose: () => void;
  onCreate: (fields: ModuleFieldsValues) => Promise<void>;
  onSave: (id: string, fields: ModuleFieldsValues) => Promise<void>;
}) {
  const initialFields =
    state.mode === "edit" ? state.fields : createEmptyModuleFieldsValues();

  const [title, setTitle] = useState<TranslatedValue>(initialFields.title);
  const [description, setDescription] = useState<TranslatedValue>(
    initialFields.description,
  );
  const [color, setColor] = useState(initialFields.color);
  const [content, setContent] = useState<TranslatedValue>(
    initialFields.content,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // While any field's own AI action is in flight, its response can still
  // land and overwrite that field at any moment -- disabling every field
  // (not just the field the AI action targets) for that whole window is
  // what ANA-94 fixes: previously only the action buttons themselves
  // showed a loading state, leaving every field, including Color, freely
  // editable underneath an in-flight request that could clobber it seconds
  // later. Each FormField reports its own busy window via `onBusyChange`
  // (ANA-97) rather than this component tracking loading state itself.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [contentBusy, setContentBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy || contentBusy;

  async function handlePrimaryAction() {
    setSaveError(null);
    setIsSaving(true);

    try {
      const fields: ModuleFieldsValues = { title, description, color, content };

      if (state.mode === "create") {
        await onCreate(fields);
      } else {
        await onSave(state.id, fields);
      }

      onClose();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      {/* Title (ANA-98): AI Assistance is grounded in this Module's own
          Learning Material plus the Book's title/description/longDescription
          -- naming this Module, never restating the Book's own title or
          summarizing the Learning Material (see suggest-module-title.ts's
          base prompt). Translate with AI is grounded in the same Learning
          Material context, so an isolated title string isn't translated
          without knowing what it's naming. */}
      <FormField
        label="Title"
        translatable
        value={title}
        onChange={setTitle}
        disabled={aiBusy}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "title",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleContent: toTranslatableString(content),
        })}
        aiAssistance
        onAiAssist={({ text, language, instructions, context }) =>
          suggestModuleTitle({
            bookId: book.id,
            text,
            language: (language ?? "ar") as AiAssistLanguage,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleContent: toTranslatableString(content),
        })}
        onBusyChange={setTitleBusy}
      />

      {/* Description (ANA-98): AI Assistance and Translate with AI are both
          grounded in this Module's own Title and Learning Material plus the
          Book's title/description/longDescription -- describing this
          specific Module within its Book, never restating the Book's own
          description (see suggest-module-description.ts's base prompt). */}
      <FormField
        label="Description"
        translatable
        value={description}
        onChange={setDescription}
        disabled={aiBusy}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "description",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleTitle: toTranslatableString(title),
          moduleContent: toTranslatableString(content),
        })}
        aiAssistance
        onAiAssist={({ text, language, instructions, context }) =>
          suggestModuleDescription({
            bookId: book.id,
            text,
            language: (language ?? "ar") as AiAssistLanguage,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleTitle: toTranslatableString(title),
          moduleContent: toTranslatableString(content),
        })}
        onBusyChange={setDescriptionBusy}
      />

      {/* Content (ANA-98): this Module's Learning Material -- still loaded/
          saved through the Material persistence established in ANA-94, this
          field only gains AI context here. AI Assistance and Translate with
          AI are both grounded in this Module's own Title/Description plus
          the Book's title/description/longDescription, so a refinement or
          translation is framed by its owning Module, not just its Book. */}
      <FormField
        label="Content"
        type="markdown"
        translatable
        value={content}
        onChange={setContent}
        disabled={aiBusy}
        aiTranslation
        onAiTranslate={({ text, instructions, context }) =>
          translateModuleField({
            bookId: book.id,
            field: "content",
            text,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAITranslationContext={() => ({
          moduleTitle: toTranslatableString(title),
          moduleDescription: toTranslatableString(description),
        })}
        aiAssistance
        onAiAssist={({ text, language, instructions, context }) =>
          assistLearningMaterial({
            bookId: book.id,
            text,
            language: (language ?? "ar") as AiAssistLanguage,
            additionalInstructions: instructions,
            ...context,
          })
        }
        getAIAssistanceContext={() => ({
          moduleTitle: toTranslatableString(title),
          moduleDescription: toTranslatableString(description),
        })}
        onBusyChange={setContentBusy}
      />

      <ColorField value={color} onChange={setColor} disabled={aiBusy} />

      {saveError && (
        <Alert color="red" role="alert">
          {saveError}
        </Alert>
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => void handlePrimaryAction()}
          loading={isSaving}
          disabled={aiBusy}
        >
          {state.mode === "create" ? "Save Module" : "Save changes"}
        </Button>
      </Group>
    </Stack>
  );
}
