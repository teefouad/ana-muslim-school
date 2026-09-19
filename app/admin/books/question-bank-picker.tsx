"use client";

import { useMemo, useState } from "react";
import {
  Button,
  getDefaultZIndex,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";

import type { Question } from "@/lib/questions/types";
import styles from "./question-bank-picker.module.css";

/** One Insert-eligible Question, tagged with where it comes from (ANA-120)
 * -- the caller (questions-editor.tsx) already resolved eligibility
 * (current Module + every previous Module in Book order, excluding
 * whatever is already linked/already inserted this session) before handing
 * this list down, so this component only ever searches/renders it. A
 * discriminated union rather than a plain `moduleId` on every candidate,
 * since a current-Module selection reuses its real id as-is while a
 * previous-Module selection must be copied into a brand-new draft (see
 * questions-editor.tsx's own `handleInsert`) -- the caller needs to tell
 * the two apart on `onSelect` either way. */
export type QuestionBankCandidate =
  | { question: Question; isCurrentModule: true }
  | { question: Question; isCurrentModule: false; moduleId: string };

export interface QuestionBankPickerProps {
  opened: boolean;
  /** Every Question eligible for Insert, already excluded/de-duplicated by
   * the caller -- see this type's own doc. */
  candidates: QuestionBankCandidate[];
  onSelect: (candidate: QuestionBankCandidate) => void;
  onClose: () => void;
}

function questionLabel(question: Question): string {
  return (
    question.text.ar?.trim() || question.text.en?.trim() || "Untitled question"
  );
}

function matchesQuery(question: Question, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    question.text.ar.toLowerCase().includes(q) ||
    question.text.en.toLowerCase().includes(q)
  );
}

function candidateKey(candidate: QuestionBankCandidate): string {
  return candidate.isCurrentModule
    ? `current:${candidate.question.id}`
    : `${candidate.moduleId}:${candidate.question.id}`;
}

// The "Insert" action's Question Bank picker (ANA-120), matching the old
// admin's own `question-bank-picker.tsx` structure (title, search input,
// scrollable results, Cancel) but scoped to Questions already loaded by the
// caller (the current Module's own list, plus every previous Module's,
// fetched through the Book-wide Questions read boundary from ANA-108)
// instead of a second, ad hoc book-scoped search endpoint. Selecting a
// result is purely a local list append in the caller (questions-editor.tsx);
// nothing here ever persists anything.
export function QuestionBankPicker({
  opened,
  candidates,
  onSelect,
  onClose,
}: QuestionBankPickerProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () =>
      candidates.filter((candidate) => matchesQuery(candidate.question, query)),
    [candidates, query],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Insert a question"
      centered
      // Pinned above Mantine's own "popover" elevation tier (ANA-127) --
      // this picker is opened from Questions editors rendered inside the
      // narrow/Drawer layout's nested Lesson editor drawer, which gets a
      // *stacked* z-index (`stackId="lesson-editor"`,
      // module-editor-body.tsx) at or above this Modal's own default
      // "modal" tier. Without this override the picker rendered underneath
      // that drawer's overlay instead of above it -- the same fix pattern
      // `ConfirmDialog`'s own `zIndex` override uses elsewhere (see e.g.
      // lesson-editor.tsx's discard confirmation).
      zIndex={getDefaultZIndex("popover")}
    >
      <Stack gap="sm">
        <TextInput
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search questions…"
          aria-label="Search questions"
        />

        <ScrollArea.Autosize mah={320} offsetScrollbars>
          {results.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No questions found.
            </Text>
          ) : (
            <Stack gap={4} role="listbox" aria-label="Questions">
              {results.map((candidate) => (
                <UnstyledButton
                  key={candidateKey(candidate)}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => onSelect(candidate)}
                  className={styles.option}
                >
                  <Text size="sm" dir="auto" truncate>
                    {questionLabel(candidate.question)}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
