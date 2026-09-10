"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  type TextareaProps,
  type TextInputProps,
} from "@mantine/core";
import { Languages, Sparkles } from "lucide-react";

import { AiInstructionsModal } from "./ai-instructions-modal";
import { ConfirmDialog } from "./confirm-dialog";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorProps,
} from "./markdown-editor";
import { TranslatableFieldHeader } from "./translatable-field-header";
import type { LanguageOption, TranslatedValue } from "./translatable-value";
import { useActiveLanguage } from "./use-active-language";

export type FormFieldType = "text" | "textarea" | "markdown";

export interface FormFieldAiActionArgs<TContext> {
  /** The whole current text the action runs on -- the active language's
   * value when translatable, the field's whole value otherwise. Never a
   * selection within it. */
  text: string;
  /** The active language slug, when this field is translatable. */
  language?: string;
  /** The Additional Instructions step's trimmed input, or `undefined` when
   * left blank. Always `undefined` for Translate with AI, which has no
   * Additional Instructions step. */
  instructions?: string;
  /** Whatever this field's own `getAITranslationContext`/
   * `getAIAssistanceContext` returned for this action. */
  context: TContext;
}

/** Runs one AI action and resolves to the replacement text. FormField never
 * calls an `/api/v1/ai/*` boundary itself -- callers wire this to the
 * existing shared client for it (e.g. `translateArabicToEnglish`,
 * `assistLearningMaterial`), supplying whatever domain context those need
 * via `args.context` (ANA-96: "do not hard-code Book-specific or
 * Module-specific context inside the reusable component"). */
export type FormFieldAiAction<TContext> = (
  args: FormFieldAiActionArgs<TContext>,
) => Promise<string>;

const DEFAULT_LANGUAGES: readonly LanguageOption[] = [
  { slug: "ar", label: "Arabic" },
  { slug: "en", label: "English" },
];

/** Internal-only slug used to store a non-translatable field's single value
 * in the same `TranslatedValue` shape the rest of this component works
 * with -- never exposed to callers. */
const PLAIN_SLUG = "__value__";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

interface FormFieldCommonProps<TContext> {
  label: string;
  /** @default "text" */
  type?: FormFieldType;
  disabled?: boolean;
  placeholder?: string;
  /** Forwarded to the underlying Mantine `TextInput` for `type="text"`.
   * Ignored for every other type. */
  textInputProps?: Omit<
    TextInputProps,
    "id" | "dir" | "value" | "onChange" | "disabled" | "placeholder"
  >;
  /** Forwarded to the underlying Mantine `Textarea` for `type="textarea"`
   * (e.g. `minRows`/`maxRows`/`autosize`). Ignored for every other type. */
  textareaProps?: Omit<
    TextareaProps,
    "id" | "dir" | "value" | "onChange" | "disabled" | "placeholder"
  >;
  /** Forwarded to the underlying `MarkdownEditor` for `type="markdown"`
   * (e.g. `fillHeight`). Ignored for every other type. */
  markdownProps?: Omit<
    MarkdownEditorProps,
    "markdown" | "onChange" | "disabled" | "placeholder" | "dir"
  >;
  /** Shows the AI Assistance action, which rewrites this field's whole
   * current text (the active language's text, when translatable) through
   * the shared Additional Instructions step. Requires `onAiAssist` -- the
   * button stays disabled without it. */
  aiAssistance?: boolean;
  onAiAssist?: FormFieldAiAction<TContext>;
  /** Invoked once, when AI Assistance is triggered -- supplies whatever
   * domain context `onAiAssist` needs (e.g. a Book id). Never inspected by
   * this component itself. */
  getAIAssistanceContext?: () => TContext;
  /** Fires whenever this field's own AI request starts or finishes -- lets
   * a caller managing several fields together freeze the rest of its form
   * while any one field's AI request is in flight, matching the Edit
   * Module modal's existing behavior. */
  onBusyChange?: (busy: boolean) => void;
}

export interface TranslatableFormFieldProps<
  TContext = unknown,
> extends FormFieldCommonProps<TContext> {
  /** Shows the language switch and stores one value per language. */
  translatable: true;
  /** @default Arabic/English */
  languages?: readonly LanguageOption[];
  value: TranslatedValue;
  onChange: (value: TranslatedValue) => void;
  /** Shows Translate with AI, which replaces the `en` value with a
   * translation of the `ar` value. Requires `onAiTranslate`, and both an
   * "ar" and an "en" language. */
  aiTranslation?: boolean;
  onAiTranslate?: FormFieldAiAction<TContext>;
  /** Invoked once, when Translate with AI is triggered. */
  getAITranslationContext?: () => TContext;
}

export interface PlainFormFieldProps<
  TContext = unknown,
> extends FormFieldCommonProps<TContext> {
  translatable?: false;
  value: string;
  onChange: (value: string) => void;
}

export type FormFieldProps<TContext = unknown> =
  TranslatableFormFieldProps<TContext> | PlainFormFieldProps<TContext>;

/** Normalizes translatable and plain fields into the same `TranslatedValue`
 * shape (a non-translatable value lives under the internal `PLAIN_SLUG`) so
 * the rest of this component -- active-value tracking, the Markdown sync
 * effect, both AI actions -- never needs a second code path for it. */
function normalizeValue<TContext>(props: FormFieldProps<TContext>) {
  if (props.translatable) {
    return { value: props.value, onChange: props.onChange };
  }

  const { value, onChange } = props;

  return {
    value: { [PLAIN_SLUG]: value },
    onChange: (next: TranslatedValue) => onChange(next[PLAIN_SLUG] ?? ""),
  };
}

function useFormFieldTranslateAction<TContext>({
  enabled,
  disabled,
  value,
  onChange,
  onAiTranslate,
  getContext,
  onBusyChange,
}: {
  enabled: boolean;
  disabled: boolean;
  value: TranslatedValue;
  onChange: (value: TranslatedValue) => void;
  onAiTranslate?: FormFieldAiAction<TContext>;
  getContext?: () => TContext;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!onAiTranslate) return;

    setLoading(true);
    onBusyChange?.(true);
    setError(null);

    try {
      const en = await onAiTranslate({
        text: value.ar ?? "",
        language: "ar",
        context: getContext ? getContext() : (undefined as TContext),
      });
      onChange({ ...value, en });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      onBusyChange?.(false);
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
    disabled:
      !enabled ||
      disabled ||
      loading ||
      !onAiTranslate ||
      !(value.ar ?? "").trim(),
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

function useFormFieldAssistAction<TContext>({
  enabled,
  disabled,
  translatable,
  activeSlug,
  activeValue,
  onApply,
  onAiAssist,
  getContext,
  onBusyChange,
}: {
  enabled: boolean;
  disabled: boolean;
  translatable: boolean;
  activeSlug: string | undefined;
  activeValue: string;
  onApply: (next: string) => void;
  onAiAssist?: FormFieldAiAction<TContext>;
  getContext?: () => TContext;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setOpen(true);
  }

  async function handleGenerate(instructions: string | undefined) {
    setOpen(false);

    if (!onAiAssist) return;

    setLoading(true);
    onBusyChange?.(true);
    setError(null);

    try {
      const refined = await onAiAssist({
        text: activeValue,
        language: translatable ? activeSlug : undefined,
        instructions,
        context: getContext ? getContext() : (undefined as TContext),
      });
      onApply(refined);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      onBusyChange?.(false);
    }
  }

  return {
    loading,
    error,
    disabled:
      !enabled || disabled || loading || !onAiAssist || !activeValue.trim(),
    handleClick,
    dialog: open ? (
      <AiInstructionsModal
        opened
        title="AI Assistance"
        description="The AI will rewrite this field's current text."
        onCancel={() => setOpen(false)}
        onGenerate={(instructions) => void handleGenerate(instructions)}
      />
    ) : null,
  };
}

// One reusable field for the repeated Title / Arabic-English / Translate
// with AI / AI Assistance pattern (ANA-96), so it's built once instead of
// independently in every screen that needs editable translatable text with
// AI actions. Renders a plain `text`/`textarea` input or a `markdown`
// editor, optionally per-language (`translatable`), with Translate with AI
// and AI Assistance as independent, optional actions -- each obtains its own
// domain context from a caller-provided builder
// (`getAITranslationContext`/`getAIAssistanceContext`) rather than this
// component knowing anything about Books or Modules, and both run through
// the same shared `/api/v1/ai/*` request shape and Additional Instructions
// step (AI Assistance only -- Translate with AI has never had one) that the
// dashboard's existing AI-assisted editing already uses. This task creates
// the abstraction only; migrating Edit Book/Edit Module's own fields onto it
// is a separate follow-up (ANA-97).
export function FormField<TContext = unknown>(props: FormFieldProps<TContext>) {
  const {
    label,
    type = "text",
    disabled = false,
    placeholder,
    textInputProps,
    textareaProps,
    markdownProps,
    aiAssistance = false,
    onAiAssist,
    getAIAssistanceContext,
    onBusyChange,
  } = props;

  const translatable = props.translatable === true;
  const languages = translatable
    ? (props.languages ?? DEFAULT_LANGUAGES)
    : [{ slug: PLAIN_SLUG, label }];

  const fieldId = useId();
  const { value, onChange } = normalizeValue(props);
  const { activeSlug, setActiveSlug, isFilled } = useActiveLanguage(
    languages,
    value,
  );
  const activeValue = activeSlug ? (value[activeSlug] ?? "") : "";

  function setActiveValue(next: string) {
    if (!activeSlug) return;
    onChange({ ...value, [activeSlug]: next });
  }

  const aiTranslation =
    props.translatable === true && Boolean(props.aiTranslation);

  const translate = useFormFieldTranslateAction({
    enabled: aiTranslation,
    disabled,
    value,
    onChange,
    onAiTranslate: props.translatable ? props.onAiTranslate : undefined,
    getContext: props.translatable ? props.getAITranslationContext : undefined,
    onBusyChange,
  });

  const assist = useFormFieldAssistAction({
    enabled: aiAssistance,
    disabled,
    translatable,
    activeSlug,
    activeValue,
    onApply: setActiveValue,
    onAiAssist,
    getContext: getAIAssistanceContext,
    onBusyChange,
  });

  const fieldBusy = disabled || translate.loading || assist.loading;

  // MarkdownEditor's `markdown` prop only seeds the editor's *initial*
  // content -- an external change to the active value (an AI Assistance
  // result, a language switch to a value already edited elsewhere) has to be
  // pushed in via `MarkdownEditorHandle.setMarkdown` instead of relying on
  // a prop update. This is a byte-for-byte port of TranslatableTextArea's own
  // audited `shown` effect (components/ui/translatable-text-area.tsx).
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [shown, setShown] = useState({ slug: activeSlug, value: activeValue });

  /* eslint-disable react-hooks/set-state-in-effect -- see the comment above;
     flagged here only because FormField is a plain function component
     rather than forwardRef-wrapped, matching the identical exemption in
     learning-material-module-card.tsx for the same pattern. */
  useEffect(() => {
    if (type !== "markdown") return;

    if (shown.slug !== activeSlug) {
      setShown({ slug: activeSlug, value: activeValue });
      return;
    }
    if (shown.value !== activeValue) {
      editorRef.current?.setMarkdown(activeValue);
      setShown({ slug: activeSlug, value: activeValue });
    }
  }, [type, activeSlug, activeValue, shown]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!activeSlug) return null;

  const headerActions = (
    <Group gap="xs" wrap="nowrap">
      {aiAssistance && (
        <ActionIcon
          variant="subtle"
          aria-label={`AI Assistance for ${label}`}
          disabled={assist.disabled || translate.loading}
          loading={assist.loading}
          onClick={assist.handleClick}
        >
          <Sparkles size={16} aria-hidden="true" />
        </ActionIcon>
      )}
      {aiTranslation && (
        <ActionIcon
          variant="subtle"
          aria-label={`Translate ${label} with AI`}
          disabled={translate.disabled || assist.loading}
          loading={translate.loading}
          onClick={translate.handleClick}
        >
          <Languages size={16} aria-hidden="true" />
        </ActionIcon>
      )}
    </Group>
  );

  return (
    <Stack gap={4}>
      {translatable ? (
        <TranslatableFieldHeader
          label={label}
          htmlFor={type !== "markdown" ? fieldId : undefined}
          languages={languages}
          activeSlug={activeSlug}
          onActiveSlugChange={setActiveSlug}
          isFilled={isFilled}
          disabled={fieldBusy}
          actions={headerActions}
        />
      ) : (
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text
            component={type !== "markdown" ? "label" : "p"}
            htmlFor={type !== "markdown" ? fieldId : undefined}
            size="sm"
            fw={500}
          >
            {label}
          </Text>
          {headerActions}
        </Group>
      )}

      {type === "text" && (
        <TextInput
          id={fieldId}
          dir="auto"
          value={activeValue}
          onChange={(event) => setActiveValue(event.currentTarget.value)}
          placeholder={placeholder}
          disabled={fieldBusy}
          {...textInputProps}
        />
      )}

      {type === "textarea" && (
        <Textarea
          id={fieldId}
          dir="auto"
          value={activeValue}
          onChange={(event) => setActiveValue(event.currentTarget.value)}
          placeholder={placeholder}
          disabled={fieldBusy}
          {...textareaProps}
        />
      )}

      {type === "markdown" && (
        <MarkdownEditor
          key={activeSlug}
          ref={editorRef}
          markdown={activeValue}
          onChange={(markdown) => {
            setShown({ slug: activeSlug, value: markdown });
            setActiveValue(markdown);
          }}
          placeholder={placeholder}
          disabled={fieldBusy}
          dir={translatable ? (activeSlug === "ar" ? "rtl" : "ltr") : undefined}
          {...markdownProps}
        />
      )}

      {translatable && translate.error && (
        <Alert color="red" py={4} role="alert">
          {translate.error}
        </Alert>
      )}
      {assist.error && (
        <Alert color="red" py={4} role="alert">
          {assist.error}
        </Alert>
      )}
      {translatable && translate.dialog}
      {assist.dialog}
    </Stack>
  );
}
