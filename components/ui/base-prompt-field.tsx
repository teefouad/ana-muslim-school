"use client";

import { Alert, Button, Textarea } from "@mantine/core";

import type { BasePromptState } from "./use-base-prompt";

// The editable base-prompt field every AI dialog shows (ANA-134): the prompt
// is never hidden from the admin, who can send it as-is or edit it first.
// State lives in `useBasePrompt` so the owning dialog reads the final value
// when Generate is clicked.
export function BasePromptField({
  state,
  disabled,
}: {
  state: BasePromptState;
  disabled?: boolean;
}) {
  if (state.error) {
    return (
      <Alert color="red" mb="md" role="alert">
        Couldn&rsquo;t load the base prompt: {state.error}
      </Alert>
    );
  }

  return (
    <div style={{ marginBottom: "var(--mantine-spacing-md)" }}>
      <Textarea
        label="Base prompt"
        description="Sent to the AI exactly as shown. Edit it to change what the AI is asked to do."
        value={state.prompt}
        onChange={(event) => state.setPrompt(event.currentTarget.value)}
        placeholder={state.isLoading ? "Loading prompt…" : undefined}
        disabled={disabled || state.isLoading}
        autosize
        minRows={6}
        maxRows={14}
      />
      {state.isEdited && (
        <Button
          variant="subtle"
          size="compact-xs"
          mt={4}
          disabled={disabled}
          onClick={state.reset}
        >
          Reset to default
        </Button>
      )}
    </div>
  );
}
