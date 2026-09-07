"use client";

import { Alert, Button, Textarea } from "@mantine/core";

import styles from "./saved-source-view.module.css";

export interface SavedSourceViewProps {
  /** The persisted Source's full text (ANA-71). Read-only in this card --
   * editing the saved Source is out of scope. */
  content: string;
  onRemove: () => void;
  /** True while the DELETE request is in flight -- disables the button and
   * shows a loading state. */
  isRemoving: boolean;
  /** Set when removal fails; the saved Source stays visible so the user can
   * retry instead of silently losing it. */
  removeError: string | null;
}

// Shown in place of the PDF upload flow when Import Source opens for a Book
// that already has a persisted Source (ANA-71) -- the original PDF is
// intentionally not preserved after OCR, so this is a simple read-only text
// surface rather than the PDF viewer.
export function SavedSourceView({
  content,
  onRemove,
  isRemoving,
  removeError,
}: SavedSourceViewProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <Textarea
          value={content}
          readOnly
          aria-label="Saved source text"
          className={styles.textareaRoot}
          classNames={{ wrapper: styles.textareaWrapper }}
          styles={{
            input: {
              flex: 1,
              minHeight: 0,
              height: "100%",
              resize: "none",
              backgroundColor: "#ffffff",
              color: "#1a1a1a",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 14,
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

      <div className={styles.footer}>
        <Button
          variant="default"
          color="red"
          loading={isRemoving}
          disabled={isRemoving}
          onClick={onRemove}
        >
          Remove source text
        </Button>
      </div>
    </div>
  );
}
