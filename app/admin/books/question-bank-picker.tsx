"use client";

import { useMemo, useState } from "react";
import {
  Button,
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

export interface QuestionBankPickerProps {
  opened: boolean;
  /** Every Question currently loaded for the owning Module (ANA-120) --
   * the same list `moduleQuestions` already threaded down to the Lesson
   * editor, filtered here by `excludeQuestionIds` and the search query
   * rather than fetched again through a second, book-scoped search
   * endpoint (the old admin's `question-bank-picker.tsx` reference queries
   * `searchQuestions` directly; this School data model has no per-Section
   * question search boundary yet, and a Lesson may only reference Questions
   * from its own Module regardless). */
  questions: Question[];
  /** Persisted Question ids already present in the current Lesson --
   * excluded from the results. A brand-new, unsaved Question draft has no
   * persisted id and is therefore never represented here. */
  excludeQuestionIds: string[];
  onSelect: (question: Question) => void;
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

// The "Insert" action's Question Bank picker (ANA-120), matching the old
// admin's own `question-bank-picker.tsx` structure (title, search input,
// scrollable results, Cancel) but scoped to the current Module's already-
// loaded Questions instead of a book-scoped server search -- see
// `QuestionBankPickerProps.questions`'s own doc. Selecting a result is
// purely a local list append in the caller (questions-editor.tsx); nothing
// here ever persists anything.
export function QuestionBankPicker({
  opened,
  questions,
  excludeQuestionIds,
  onSelect,
  onClose,
}: QuestionBankPickerProps) {
  const [query, setQuery] = useState("");

  const excludeIds = useMemo(
    () => new Set(excludeQuestionIds),
    [excludeQuestionIds],
  );

  const results = useMemo(
    () =>
      questions.filter(
        (question) =>
          !excludeIds.has(question.id) && matchesQuery(question, query),
      ),
    [questions, excludeIds, query],
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Insert a question" centered>
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
              {results.map((question) => (
                <UnstyledButton
                  key={question.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => onSelect(question)}
                  className={styles.option}
                >
                  <Text size="sm" dir="auto" truncate>
                    {questionLabel(question)}
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
