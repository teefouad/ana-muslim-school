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
import type { ModuleFieldsValues } from "./module-fields";

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

export interface EditModuleModalProps {
  /** `null` closes the modal. Set to open it, seeded with that Module's
   * current field values -- see `getInitialModuleFields` in
   * `[id]/edit/page.tsx`. */
  module: (ModuleFieldsValues & { id: string }) | null;
  /** The owning Book, needed for AI Suggest's `/api/v1/ai/assist` request
   * (it loads Book context server-side). */
  bookId: string;
  onClose: () => void;
  /** Save changes never persists to the backend (ANA-91, frontend-only) --
   * this only hands the edited values back to the caller's own local
   * state. */
  onSave: (id: string, fields: ModuleFieldsValues) => void;
}

// Top-level modal (ANA-91) opened from the Edit Book screen's Modules panel
// -- deliberately a sibling of, not nested inside, the Module Builder modal
// (ImportSourceModal). Title, Description, Color, and Content are fully
// controlled from a local copy of `module`'s fields, initialized once per
// mount (remounted by `module.id` changing, matching BookForm/DeleteConfirm
// Modal's own "T | null` as the open signal" pattern) -- editing here never
// touches the caller's data until Save changes.
export function EditModuleModal({
  module,
  bookId,
  onClose,
  onSave,
}: EditModuleModalProps) {
  return (
    <Modal
      opened={module !== null}
      onClose={onClose}
      title="Edit Module"
      size="lg"
      centered
    >
      {module && (
        <EditModuleModalBody
          key={module.id}
          module={module}
          bookId={bookId}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function EditModuleModalBody({
  module,
  bookId,
  onClose,
  onSave,
}: {
  module: ModuleFieldsValues & { id: string };
  bookId: string;
  onClose: () => void;
  onSave: (id: string, fields: ModuleFieldsValues) => void;
}) {
  const [title, setTitle] = useState<TranslatedValue>(module.title);
  const [description, setDescription] = useState<TranslatedValue>(
    module.description,
  );
  const [color, setColor] = useState(module.color);
  const [content, setContent] = useState<TranslatedValue>(module.content);

  const titleTranslate = useTranslateAction(title, setTitle);
  const descriptionTranslate = useTranslateAction(description, setDescription);
  const descriptionSuggest = useSuggestAction(
    bookId,
    description,
    setDescription,
  );

  function handleSave() {
    onSave(module.id, { title, description, color, content });
  }

  return (
    <Stack gap="lg">
      <TranslatableTextInput
        label="Title"
        languages={LANGUAGES}
        value={title}
        onChange={setTitle}
        actions={() => (
          <ActionIcon
            variant="subtle"
            aria-label="Translate title to English"
            disabled={titleTranslate.disabled}
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

      <TranslatableTextArea
        label="Description"
        languages={LANGUAGES}
        value={description}
        onChange={setDescription}
        actions={(activeSlug) => (
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              aria-label="AI Suggest description"
              disabled={descriptionSuggest.isDisabled(activeSlug)}
              loading={descriptionSuggest.loading}
              onClick={() => descriptionSuggest.handleClick(activeSlug)}
            >
              <Sparkles size={16} aria-hidden="true" />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              aria-label="Translate description to English"
              disabled={descriptionTranslate.disabled}
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

      <ColorField value={color} onChange={setColor} />

      <TranslatableTextArea
        label="Content"
        languages={LANGUAGES}
        value={content}
        onChange={setContent}
      />

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save changes</Button>
      </Group>
    </Stack>
  );
}
