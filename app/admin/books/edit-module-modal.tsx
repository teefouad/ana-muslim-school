"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { Languages, Sparkles } from "lucide-react";

import { ColorField } from "@/components/ui/color-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TranslatableTextArea } from "@/components/ui/translatable-text-area";
import { TranslatableTextInput } from "@/components/ui/translatable-text-input";
import type {
  LanguageOption,
  TranslatedValue,
} from "@/components/ui/translatable-value";
import { assistLearningMaterial } from "./import-source/ai-assist-client";
import { translateArabicToEnglish } from "./import-source/translate-client";
import {
  createEmptyModuleFieldsValues,
  type ModuleFieldsValues,
} from "./module-fields";

const LANGUAGES: LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Arabic -> English translation for a single translatable field (ANA-91),
 * using the same `/api/v1/ai/translate` boundary and confirm-before-
 * overwrite behavior already established for Learning Material
 * (learning-material-module-card.tsx) -- only this field's own `en` value
 * ever changes, and only on a successful request. */
function useTranslateAction(
  value: TranslatedValue,
  onChange: (value: TranslatedValue) => void,
) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);

    try {
      const en = await translateArabicToEnglish(value.ar ?? "");
      onChange({ ...value, en });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if ((value.en ?? "").trim()) {
      setConfirming(true);
      return;
    }
    void run();
  }

  return {
    loading,
    error,
    disabled: loading || !(value.ar ?? "").trim(),
    handleClick,
    dialog: confirming ? (
      <ConfirmDialog
        opened
        title="Replace English translation?"
        description="Translating again will replace the current English text."
        confirmLabel="Translate and replace"
        cancelLabel="Cancel"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void run();
        }}
      />
    ) : null,
  };
}

/** AI Suggest for a single translatable field (ANA-91): rewrites the
 * currently active language's whole text via the same `/api/v1/ai/assist`
 * boundary AI Assistant already uses for Learning Material, scoped to this
 * one field instead of a Markdown selection. */
function useSuggestAction(
  bookId: string,
  value: TranslatedValue,
  onChange: (value: TranslatedValue) => void,
) {
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState("ar");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick(slug: string) {
    setActiveSlug(slug);
    setInstructions("");
    setError(null);
    setOpen(true);
  }

  async function handleGenerate() {
    const language = activeSlug === "en" ? "en" : "ar";
    setOpen(false);
    setLoading(true);
    setError(null);

    try {
      const refined = await assistLearningMaterial({
        bookId,
        text: value[activeSlug] ?? "",
        language,
        additionalInstructions: instructions.trim() || undefined,
      });
      onChange({ ...value, [activeSlug]: refined });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    isDisabled: (slug: string) => loading || !(value[slug] ?? "").trim(),
    handleClick,
    dialog: open ? (
      <Modal opened onClose={() => setOpen(false)} title="AI Suggest" centered>
        <Text size="sm" c="dimmed" mb="md">
          The AI will rewrite this field&rsquo;s current text.
        </Text>
        <Textarea
          label="Additional instructions or context (optional)"
          value={instructions}
          onChange={(event) => setInstructions(event.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
          mb="lg"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleGenerate()}>Generate</Button>
        </Group>
      </Modal>
    ) : null,
  };
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

  const titleTranslate = useTranslateAction(title, setTitle);
  const descriptionTranslate = useTranslateAction(description, setDescription);
  const descriptionSuggest = useSuggestAction(
    bookId,
    description,
    setDescription,
  );

  // While either AI action is in flight, its response can still land and
  // overwrite Title/Description at any moment -- disabling every field
  // (not just the field the AI action targets) for that whole window is
  // what ANA-94 fixes: previously only the action buttons themselves
  // showed a loading state, leaving every field, including Color and
  // Content, freely editable underneath an in-flight request that could
  // clobber it seconds later.
  const aiBusy =
    titleTranslate.loading ||
    descriptionTranslate.loading ||
    descriptionSuggest.loading;

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
      <TranslatableTextInput
        label="Title"
        languages={LANGUAGES}
        value={title}
        onChange={setTitle}
        disabled={aiBusy}
        actions={() => (
          <ActionIcon
            variant="subtle"
            aria-label="Translate title to English"
            disabled={titleTranslate.disabled || isSaving}
            loading={titleTranslate.loading}
            onClick={titleTranslate.handleClick}
          >
            <Languages size={16} aria-hidden="true" />
          </ActionIcon>
        )}
      />
      {titleTranslate.error && (
        <Alert color="red" py={4} role="alert">
          {titleTranslate.error}
        </Alert>
      )}
      {titleTranslate.dialog}

      <TranslatableTextInput
        label="Description"
        languages={LANGUAGES}
        value={description}
        onChange={setDescription}
        disabled={aiBusy}
        actions={(activeSlug) => (
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              aria-label="AI Suggest description"
              disabled={descriptionSuggest.isDisabled(activeSlug) || isSaving}
              loading={descriptionSuggest.loading}
              onClick={() => descriptionSuggest.handleClick(activeSlug)}
            >
              <Sparkles size={16} aria-hidden="true" />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              aria-label="Translate description to English"
              disabled={descriptionTranslate.disabled || isSaving}
              loading={descriptionTranslate.loading}
              onClick={descriptionTranslate.handleClick}
            >
              <Languages size={16} aria-hidden="true" />
            </ActionIcon>
          </Group>
        )}
      />
      {descriptionTranslate.error && (
        <Alert color="red" py={4} role="alert">
          {descriptionTranslate.error}
        </Alert>
      )}
      {descriptionSuggest.error && (
        <Alert color="red" py={4} role="alert">
          {descriptionSuggest.error}
        </Alert>
      )}
      {descriptionTranslate.dialog}
      {descriptionSuggest.dialog}

      <TranslatableTextArea
        label="Content"
        languages={LANGUAGES}
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
