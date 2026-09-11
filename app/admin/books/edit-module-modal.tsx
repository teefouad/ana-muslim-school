"use client";

import { useState } from "react";
import { Alert, Button, Group, Modal, Stack } from "@mantine/core";

import { ColorField } from "@/components/ui/color-field";
import { FormField } from "@/components/ui/form-field";
import type { TranslatedValue } from "@/components/ui/translatable-value";
import {
  assistLearningMaterial,
  type AiAssistLanguage,
} from "./import-source/ai-assist-client";
import { translateArabicToEnglish } from "./import-source/translate-client";
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Arabic -> English translation for Title/Description (ANA-91), wired
 * through `FormField`'s own `aiTranslation` action (ANA-97) -- neither field
 * needs any Book/Module-specific context, so this is just a thin adapter
 * over the shared `/api/v1/ai/translate` boundary. */
function translateTitleOrDescription({ text }: { text: string }) {
  return translateArabicToEnglish(text);
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
  /** The owning Book -- needed for AI Suggest's `/api/v1/ai/assist` request
   * (it loads Book context server-side) and for the caller's own
   * create/save requests. */
  bookId: string;
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
  bookId,
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
          bookId={bookId}
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
  bookId,
  onClose,
  onCreate,
  onSave,
}: {
  state: EditModuleModalState;
  bookId: string;
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

  // While either field's own AI action is in flight, its response can still
  // land and overwrite Title/Description at any moment -- disabling every
  // field (not just the field the AI action targets) for that whole window
  // is what ANA-94 fixes: previously only the action buttons themselves
  // showed a loading state, leaving every field, including Color and
  // Content, freely editable underneath an in-flight request that could
  // clobber it seconds later. Each FormField reports its own busy window via
  // `onBusyChange` (ANA-97) rather than this component tracking loading
  // state itself.
  const [titleBusy, setTitleBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const aiBusy = titleBusy || descriptionBusy;

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
      <FormField
        label="Title"
        translatable
        value={title}
        onChange={setTitle}
        disabled={aiBusy}
        aiTranslation
        onAiTranslate={translateTitleOrDescription}
        onBusyChange={setTitleBusy}
      />

      <FormField
        label="Description"
        translatable
        value={description}
        onChange={setDescription}
        disabled={aiBusy}
        aiTranslation
        onAiTranslate={translateTitleOrDescription}
        aiAssistance
        onAiAssist={({ text, language, instructions }) =>
          assistLearningMaterial({
            bookId,
            text,
            language: (language ?? "ar") as AiAssistLanguage,
            additionalInstructions: instructions,
          })
        }
        onBusyChange={setDescriptionBusy}
      />

      <FormField
        label="Content"
        type="markdown"
        translatable
        value={content}
        onChange={setContent}
        disabled={aiBusy}
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
