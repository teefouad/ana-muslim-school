"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import {
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

import { ActionIconButton } from "./action-icon-button";
import { AiInstructionsModal } from "./ai-instructions-modal";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorProps,
  type MarkdownSelectionCapture,
} from "./markdown-editor";
import { TranslatableFieldHeader } from "./translatable-field-header";
import type { LanguageOption, TranslatedValue } from "./translatable-value";
import { useActiveLanguage } from "./use-active-language";

export type FormFieldType = "text" | "textarea" | "markdown";

interface FormFieldAiActionArgs<TContext> {
  /** The text the action runs on. For Translate with AI, and for AI
   * Assistance on every type other than `"markdown"`, this is always the
   * whole current text (the active language's value, when translatable).
   * For AI Assistance on `type="markdown"`, this is the editor's current
   * selection when there is a non-empty one, or the whole value otherwise
   * -- see `aiAssistance` on `FormFieldProps`. */
  text: string;
  /** The active language slug, when this field is translatable. */
  language?: string;
  /** The Additional Instructions step's trimmed input, or `undefined` when
   * left blank. Always `undefined` for Translate with AI, which has no
   * Additional Instructions step (ANA-98). */
  instructions?: string;
  /** True when `text` is a Markdown selection captured from a `type=
   * "markdown"` field's editor, rather than the field's whole current
   * value (ANA-99) -- lets a domain caller decide whether to supply the
   * rest of the field's own current value as extra surrounding context
   * (e.g. the full Learning Material around a selected paragraph) via
   * `context`. Always `false` for Translate with AI and for every
   * non-markdown field, which never operate on a selection. This is the
   * only selection signal `FormField` exposes -- it stays generic and
   * knows nothing about what a caller does with it. */
  isSelection: boolean;
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
  /** Shows the AI Assistance action, which rewrites this field's current
   * text (the active language's text, when translatable) through the
   * shared Additional Instructions step. Stays enabled even when the field
   * is empty -- caller-supplied context alone may be enough to generate a
   * value (e.g. a Module Title generated from its Learning Material and
   * Book). For `type="markdown"`, operates on the editor's current
   * selection when there is one (replacing only that range), and falls
   * back to the whole value otherwise. Requires `onAiAssist` -- the button
   * stays disabled without it. */
  aiAssistance?: boolean;
  onAiAssist?: FormFieldAiAction<TContext>;
  /** Invoked once, when AI Assistance is triggered -- supplies whatever
   * domain context `onAiAssist` needs (e.g. a Book id). Never inspected by
   * this component itself. */
  getAIAssistanceContext?: () => TContext;
  /** Fires whenever this field's own AI request starts or finishes. This
   * field already disables itself for that window via its own internal
   * `fieldBusy` -- a caller must not feed this back into another field's
   * `disabled` (or a non-AI control's), which would freeze unrelated UI for
   * an AI request it has nothing to do with (ANA-109). A caller may still
   * aggregate several fields' `onBusyChange` calls to gate its own action
   * that isn't a field at all, e.g. disabling a Save button so it can't
   * persist a value while that value's own translation is still in flight
   * (see module-editor-body.tsx's `aiBusy`, ANA-109 PR review). */
  onBusyChange?: (busy: boolean) => void;
}

interface TranslatableFormFieldProps<
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
  /** Pins AI Assistance to always read from, and write its result back to,
   * this one language -- independent of whichever tab is currently active
   * (ANA-116 PR review). For a field whose `onAiAssist` is documented to
   * always generate one fixed language (e.g. a Lesson Title/Description
   * Suggest that always returns Arabic, while the field itself stays
   * translatable so English can still be filled in separately via
   * Translate with AI or typed by hand), the default behavior -- writing
   * the result into whichever tab is active when Generate is clicked --
   * would silently write that fixed language's output into the *other*
   * language's slot the moment an editor switches tabs first. Omit for the
   * default, tab-following behavior (e.g. Book-level `bookDescription`/
   * `bookLongDescription`, whose own prompt is required to match whichever
   * language `FormFieldAiActionArgs.language` reports, see
   * components/README.md). Only affects the whole-field apply path -- for
   * `type="markdown"`, a Markdown-selection AI Assistance run still targets
   * whichever tab's editor the selection was made in, so this option only
   * makes sense for a field that never runs AI Assistance on a selection. */
  aiAssistanceLanguage?: string;
}

interface PlainFormFieldProps<
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
  // Translate with AI deliberately runs directly, with no Additional
  // Instructions step (ANA-98 -- unlike AI Assistance, which always shows
  // one): it only ever transforms the whole Arabic value into English,
  // never something an editor needs to redirect with free-form guidance.
  // Clicking Translate always runs immediately, with no confirmation step,
  // even when overwriting a non-empty English value (ANA-102) -- the
  // existing English value stays untouched until the request resolves, and
  // a failed request never overwrites it.
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
        isSelection: false,
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

  return {
    loading,
    error,
    disabled:
      !enabled ||
      disabled ||
      loading ||
      !onAiTranslate ||
      !(value.ar ?? "").trim(),
    handleClick: () => void run(),
  };
}

/** A Markdown selection AI Assistance captured at click time (before the
 * Additional Instructions dialog steals focus) -- `capture` is the
 * restorable Lexical range `handleGenerate` later hands to
 * `replaceCapturedSelection`, `text` is the Markdown sent to the AI in
 * place of the whole field. `null` whenever the editor had no non-empty
 * selection, in which case AI Assistance falls back to the whole field. */
interface PendingMarkdownSelection {
  capture: MarkdownSelectionCapture;
  text: string;
}

function useFormFieldAssistAction<TContext>({
  enabled,
  disabled,
  type,
  translatable,
  activeSlug,
  activeValue,
  editorRef,
  onApply,
  onAiAssist,
  getContext,
  onBusyChange,
}: {
  enabled: boolean;
  disabled: boolean;
  type: FormFieldType;
  translatable: boolean;
  activeSlug: string | undefined;
  activeValue: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onApply: (next: string) => void;
  onAiAssist?: FormFieldAiAction<TContext>;
  getContext?: () => TContext;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<PendingMarkdownSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    // Captured here, not in handleGenerate -- opening the dialog moves
    // focus into its own Textarea, which would otherwise collapse the
    // editor's live selection before Generate ever reads it. Nothing is
    // mutated by capturing it (PR review precedent, see
    // learning-material-module-card.tsx), so there's nothing to undo if the
    // dialog is cancelled.
    if (type === "markdown") {
      const selectedMarkdown = editorRef.current?.getSelectedMarkdown() ?? "";
      const capture = editorRef.current?.captureSelection() ?? null;
      setPendingSelection(
        selectedMarkdown.trim() && capture
          ? { capture, text: selectedMarkdown }
          : null,
      );
    }

    setOpen(true);
  }

  async function handleGenerate(instructions: string | undefined) {
    const selection = pendingSelection;
    setOpen(false);
    setPendingSelection(null);

    if (!onAiAssist) return;

    setLoading(true);
    onBusyChange?.(true);
    setError(null);

    try {
      const refined = await onAiAssist({
        text: selection ? selection.text : activeValue,
        language: translatable ? activeSlug : undefined,
        instructions,
        isSelection: selection !== null,
        context: getContext ? getContext() : (undefined as TContext),
      });

      if (selection) {
        // Replaces exactly the captured range using the editor's own
        // selection-aware node insertion (never a text search against the
        // original selected text, which may recur elsewhere in the
        // document) -- this fires the editor's own `onChange`, routing
        // through `onApply` exactly like a manual edit would.
        editorRef.current?.replaceCapturedSelection(selection.capture, refined);
      } else {
        onApply(refined);
      }
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
    // Deliberately not gated on `activeValue`/selection being non-empty --
    // caller-supplied context alone (e.g. a Module's Learning Material and
    // Book) may be enough to generate a value for a currently-empty field.
    disabled: !enabled || disabled || loading || !onAiAssist,
    handleClick,
    dialog: open ? (
      <AiInstructionsModal
        opened
        title="AI Assistance"
        description={
          pendingSelection
            ? "The AI will transform the text you selected. The rest of the field stays untouched."
            : "The AI will rewrite this field's current text."
        }
        onCancel={() => {
          setOpen(false);
          setPendingSelection(null);
        }}
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
// step (AI Assistance only -- Translate with AI runs directly, by design,
// ANA-98) that the dashboard's existing AI-assisted editing already uses.
// Edit Book and Edit Module's own Title/Description/(Long )Description/
// Content fields are migrated onto this component in book-form.tsx and
// module-editor-body.tsx (ANA-97), with Edit Module's fields wired to their
// full Book/Module AI context in ANA-98.
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

  // MarkdownEditor's `markdown` prop only seeds the editor's *initial*
  // content -- an external change to the active value (an AI Assistance
  // result, a language switch to a value already edited elsewhere) has to be
  // pushed in via `MarkdownEditorHandle.setMarkdown` instead of relying on
  // a prop update. This is a byte-for-byte port of TranslatableTextArea's own
  // audited `shown` effect (components/ui/translatable-text-area.tsx). Also
  // handed to AI Assistance below, so a `type="markdown"` field can read/
  // replace the editor's own selection (ANA-96 PR review).
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [shown, setShown] = useState({ slug: activeSlug, value: activeValue });

  // `aiAssistanceLanguage` (ANA-116 PR review) pins AI Assistance's whole-
  // field (non-selection) source text and apply target to one fixed
  // language, overriding the default tab-following `activeSlug`/
  // `setActiveValue` -- see the prop's own doc for why. `undefined` (the
  // default) falls through to the existing tab-following behavior
  // unchanged.
  const aiAssistanceLanguage = props.translatable
    ? props.aiAssistanceLanguage
    : undefined;
  const assistSlug = aiAssistanceLanguage ?? activeSlug;
  const assistSourceValue = aiAssistanceLanguage
    ? (value[aiAssistanceLanguage] ?? "")
    : activeValue;

  function applyAssistResult(next: string) {
    if (aiAssistanceLanguage) {
      onChange({ ...value, [aiAssistanceLanguage]: next });
      return;
    }
    setActiveValue(next);
  }

  const assist = useFormFieldAssistAction({
    enabled: aiAssistance,
    disabled,
    type,
    translatable,
    activeSlug: assistSlug,
    activeValue: assistSourceValue,
    editorRef,
    onApply: applyAssistResult,
    onAiAssist,
    getContext: getAIAssistanceContext,
    onBusyChange,
  });

  const fieldBusy = disabled || translate.loading || assist.loading;

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
        <ActionIconButton
          aria-label={`AI Assistance for ${label}`}
          disabled={assist.disabled || translate.loading}
          loading={assist.loading}
          onClick={assist.handleClick}
        >
          <Sparkles size={16} aria-hidden="true" />
        </ActionIconButton>
      )}
      {aiTranslation && (
        <ActionIconButton
          aria-label={`Translate ${label} with AI`}
          disabled={translate.disabled || assist.loading}
          loading={translate.loading}
          onClick={translate.handleClick}
        >
          <Languages size={16} aria-hidden="true" />
        </ActionIconButton>
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
      {assist.dialog}
    </Stack>
  );
}
