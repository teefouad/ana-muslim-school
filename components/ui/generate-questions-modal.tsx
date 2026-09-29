"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Alert,
  Button,
  getDefaultZIndex,
  Group,
  Modal,
  Text,
  Textarea,
} from "@mantine/core";

import { ActionIconButton } from "./action-icon-button";
import { BasePromptField } from "./base-prompt-field";
import { useBasePrompt } from "./use-base-prompt";

const DEFAULT_QUESTION_COUNT = 5;
// Mirrors lib/ai/generate-questions-service.ts's own
// MIN/MAX_GENERATED_QUESTION_COUNT (that module is `server-only` and can't
// be imported from a Client Component) -- keep both in sync if either
// changes.
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;

export interface GenerateQuestionsInput {
  sourceText: string;
  additionalInstructions?: string;
  /** The base prompt shown in the modal (ANA-134) -- default or edited. */
  basePrompt: string;
  count: number;
}

export interface GenerateQuestionsModalProps {
  /** Always `true` in practice -- callers mount this modal only while it's
   * open (`{open && <GenerateQuestionsModal ... />}`), matching
   * ConfirmDialog/AiInstructionsModal's own conditional-mount pattern. */
  opened: boolean;
  /** True while a generation request is in flight -- shows a loading state
   * on Generate and blocks every way of dismissing the modal (Escape/
   * backdrop/close button/Cancel), matching ConfirmDialog's `isConfirming`. */
  isGenerating?: boolean;
  /** A failed generation's error message (ANA-131: "Generation errors
   * should be surfaced to the user without losing the entered passage or
   * instructions") -- unlike AiInstructionsModal, which closes immediately
   * on Generate, this modal stays open and keeps its own `sourceText`/
   * `instructions` draft intact so a failed request can simply be retried. */
  error?: string | null;
  onCancel: () => void;
  onGenerate: (input: GenerateQuestionsInput) => void;
}

// The "Generate Questions" modal (ANA-131) -- opened from the Questions
// editor's Generate action instead of generating immediately. Carries no AI
// request logic of its own (matching AiInstructionsModal's own doc): the
// caller owns what "Generate" actually triggers, and controls this modal's
// loading/error state from the outside so it can keep the modal open (and
// the entered passage/instructions intact) across a failed request.
export function GenerateQuestionsModal({
  opened,
  isGenerating = false,
  error = null,
  onCancel,
  onGenerate,
}: GenerateQuestionsModalProps) {
  const [sourceText, setSourceText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [count, setCount] = useState(DEFAULT_QUESTION_COUNT);
  const basePrompt = useBasePrompt("generateQuestions");

  const canDecrement = count > MIN_QUESTION_COUNT;
  const canIncrement = count < MAX_QUESTION_COUNT;

  function handleGenerate() {
    onGenerate({
      sourceText: sourceText.trim(),
      additionalInstructions: instructions.trim() || undefined,
      basePrompt: basePrompt.prompt,
      count,
    });
  }

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Generate Questions"
      centered
      closeOnEscape={!isGenerating}
      closeOnClickOutside={!isGenerating}
      withCloseButton={!isGenerating}
      // This editor can render inside a *stacked* DrawerShell (the nested
      // Lesson editor drawer, ANA-129) -- see questions-editor.tsx's own
      // ConfirmDialog for why the default modal tier isn't enough there.
      zIndex={getDefaultZIndex("popover")}
    >
      {error && (
        <Alert color="red" mb="md" role="alert">
          {error}
        </Alert>
      )}

      <Textarea
        label="Source text"
        description="The passage or source text questions should be generated from."
        value={sourceText}
        onChange={(event) => setSourceText(event.currentTarget.value)}
        autosize
        minRows={6}
        maxRows={14}
        disabled={isGenerating}
        mb="md"
      />

      <BasePromptField state={basePrompt} disabled={isGenerating} />

      <Textarea
        label="Additional instructions (optional)"
        value={instructions}
        onChange={(event) => setInstructions(event.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={8}
        disabled={isGenerating}
        mb="lg"
      />

      <Group justify="space-between" align="center" mb="lg">
        <Text size="sm" fw={500}>
          Number of questions
        </Text>
        <Group gap="xs">
          <ActionIconButton
            aria-label="Decrease question count"
            disabled={isGenerating || !canDecrement}
            onClick={() => setCount((value) => value - 1)}
          >
            <Minus size={14} aria-hidden="true" />
          </ActionIconButton>
          <Text
            size="sm"
            fw={500}
            style={{ minWidth: 24, textAlign: "center" }}
          >
            {count}
          </Text>
          <ActionIconButton
            aria-label="Increase question count"
            disabled={isGenerating || !canIncrement}
            onClick={() => setCount((value) => value + 1)}
          >
            <Plus size={14} aria-hidden="true" />
          </ActionIconButton>
        </Group>
      </Group>

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={isGenerating}>
          Cancel
        </Button>
        <Button
          loading={isGenerating}
          disabled={!sourceText.trim() || !basePrompt.isReady}
          onClick={handleGenerate}
        >
          Generate
        </Button>
      </Group>
    </Modal>
  );
}
