"use client";

import { useState } from "react";
import { Alert, Button, Group, Textarea } from "@mantine/core";

import type { TextDirection } from "./import-source-types";
import { FontSizeControl } from "./font-size-control";
import { TextDirectionControl } from "./text-direction-control";
import styles from "./saved-source-view.module.css";

export interface SavedSourceViewProps {
  /** The persisted Source's full text (ANA-71). Editable in this card --
   * `onSave` persists changes back to the Source record. */
  content: string;
  onRemove: () => void;
  /** True while the DELETE request is in flight -- disables the button and
   * shows a loading state. */
  isRemoving: boolean;
  /** Set when removal fails; the saved Source stays visible so the user can
   * retry instead of silently losing it. */
  removeError: string | null;
  onSave: (content: string) => void;
  /** True while the PATCH request is in flight -- disables Save and shows a
   * loading state. */
  isSaving: boolean;
  /** Set when saving fails; the edited text stays in the field so the user
   * can retry instead of losing their edit. */
  saveError: string | null;
  /** Same zoom/direction controls as the upload flow's OCR review step --
   * shared state owned by the modal so switching between this view and the
   * upload flow (via Select Another PDF) keeps the same reading settings. */
  fontScale: number;
  onFontScaleChange: (value: number) => void;
  direction: TextDirection;
  onDirectionChange: (value: TextDirection) => void;
}

// Shown in place of the PDF upload flow when Import Source opens for a Book
// that already has a persisted Source (ANA-71) -- the original PDF is
// intentionally not preserved after OCR, so this is a simple text surface
// rather than the PDF viewer. Editable, styled like every other Textarea in
// the dashboard (no bespoke colors) rather than as a fixed document preview.
export function SavedSourceView({
  content,
  onRemove,
  isRemoving,
  removeError,
  onSave,
  isSaving,
  saveError,
  fontScale,
  onFontScaleChange,
  direction,
  onDirectionChange,
}: SavedSourceViewProps) {
  const [value, setValue] = useState(content);
  const isDirty = value !== content;

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <Group gap="sm">
          <FontSizeControl value={fontScale} onChange={onFontScaleChange} />
          <TextDirectionControl
            value={direction}
            onChange={onDirectionChange}
          />
        </Group>
      </div>

      <div className={styles.body}>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          dir={direction}
          aria-label="Saved source text"
          className={styles.textareaRoot}
          classNames={{ wrapper: styles.textareaWrapper }}
          styles={{
            input: {
              flex: 1,
              minHeight: 0,
              height: "100%",
              resize: "none",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: `${14 * (fontScale / 100)}px`,
              lineHeight: 1.6,
              padding: 16,
              whiteSpace: "pre-wrap",
            },
          }}
        />
      </div>

      {removeError && (
        <Alert color="red" mx="md" mb="sm">
          {removeError}
        </Alert>
      )}
      {saveError && (
        <Alert color="red" mx="md" mb="sm">
          {saveError}
        </Alert>
      )}

      <div className={styles.footer}>
        <Button
          variant="default"
          color="red"
          loading={isRemoving}
          disabled={isRemoving}
          onClick={onRemove}
        >
          Select Another PDF
        </Button>
        <Button
          loading={isSaving}
          disabled={isSaving || !isDirty}
          onClick={() => onSave(value)}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
