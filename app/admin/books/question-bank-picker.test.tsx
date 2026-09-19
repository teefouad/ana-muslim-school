import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { buildQuestionFixture } from "./question-fixtures";
import {
  QuestionBankPicker,
  type QuestionBankCandidate,
} from "./question-bank-picker";

const QUESTION_1 = buildQuestionFixture({
  id: "question-1",
  text: { ar: "سؤال أول", en: "First question" },
});
const QUESTION_2 = buildQuestionFixture({
  id: "question-2",
  text: { ar: "سؤال ثاني", en: "Second question" },
});
const PREVIOUS_QUESTION = buildQuestionFixture({
  id: "previous-question-1",
  text: { ar: "سؤال من وحدة سابقة", en: "A previous-Module question" },
});

const CANDIDATE_1: QuestionBankCandidate = {
  question: QUESTION_1,
  isCurrentModule: true,
};
const CANDIDATE_2: QuestionBankCandidate = {
  question: QUESTION_2,
  isCurrentModule: true,
};
const PREVIOUS_CANDIDATE: QuestionBankCandidate = {
  question: PREVIOUS_QUESTION,
  isCurrentModule: false,
  moduleId: "module-0",
};

function renderPicker(
  overrides: Partial<Parameters<typeof QuestionBankPicker>[0]> = {},
) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MantineProvider>
      <QuestionBankPicker
        opened
        candidates={[CANDIDATE_1, CANDIDATE_2]}
        onSelect={onSelect}
        onClose={onClose}
        {...overrides}
      />
    </MantineProvider>,
  );
  return { onSelect, onClose, ...utils };
}

describe("QuestionBankPicker", () => {
  it("shows the Insert a question title and a Search questions… input", () => {
    renderPicker();

    expect(
      screen.getByRole("dialog", { name: "Insert a question" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search questions…"),
    ).toBeInTheDocument();
  });

  it("lists every given candidate with an empty query", () => {
    renderPicker();

    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
    expect(screen.getByText("سؤال ثاني")).toBeInTheDocument();
  });

  it("lists previous-Module candidates alongside current-Module ones", () => {
    renderPicker({ candidates: [CANDIDATE_1, PREVIOUS_CANDIDATE] });

    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
    expect(screen.getByText("سؤال من وحدة سابقة")).toBeInTheDocument();
  });

  it("filters by Arabic question text, case-insensitively", () => {
    renderPicker();

    fireEvent.change(screen.getByPlaceholderText("Search questions…"), {
      target: { value: "ثاني" },
    });

    expect(screen.queryByText("سؤال أول")).not.toBeInTheDocument();
    expect(screen.getByText("سؤال ثاني")).toBeInTheDocument();
  });

  it("filters by English question text, case-insensitively", () => {
    renderPicker();

    fireEvent.change(screen.getByPlaceholderText("Search questions…"), {
      target: { value: "FIRST" },
    });

    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
    expect(screen.queryByText("سؤال ثاني")).not.toBeInTheDocument();
  });

  it("shows the exact empty-state copy when nothing matches", () => {
    renderPicker();

    fireEvent.change(screen.getByPlaceholderText("Search questions…"), {
      target: { value: "no such question" },
    });

    expect(screen.getByText("No questions found.")).toBeInTheDocument();
  });

  it("shows the exact empty-state copy when given no candidates", () => {
    renderPicker({ candidates: [] });

    expect(screen.getByText("No questions found.")).toBeInTheDocument();
  });

  it("Cancel closes without selecting anything", () => {
    const { onSelect, onClose } = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selecting a current-Module result calls onSelect with that candidate", () => {
    const { onSelect } = renderPicker();

    fireEvent.click(screen.getByRole("option", { name: /سؤال ثاني/ }));

    expect(onSelect).toHaveBeenCalledWith(CANDIDATE_2);
  });

  it("selecting a previous-Module result calls onSelect with its source moduleId", () => {
    const { onSelect } = renderPicker({
      candidates: [CANDIDATE_1, PREVIOUS_CANDIDATE],
    });

    fireEvent.click(screen.getByRole("option", { name: /سؤال من وحدة سابقة/ }));

    expect(onSelect).toHaveBeenCalledWith(PREVIOUS_CANDIDATE);
  });

  it("scopes its dialog/search roles correctly", () => {
    renderPicker();

    const dialog = screen.getByRole("dialog", { name: "Insert a question" });
    expect(
      within(dialog).getByRole("listbox", { name: "Questions" }),
    ).toBeInTheDocument();
  });

  it("renders above the Lesson editor's own stacked drawer z-index (ANA-127)", () => {
    renderPicker();

    const dialog = screen.getByRole("dialog", { name: "Insert a question" });
    // Mantine's "popover" elevation tier (300) -- above the narrow/Drawer
    // layout's nested Lesson editor drawer, which gets a *stacked* z-index
    // at/above the default "modal" tier (200) this Modal would otherwise
    // use unstyled (see edit-module-drawer.test.tsx's identical assertion
    // for `ConfirmDialog`'s own equivalent fix).
    expect(
      dialog.closest(".mantine-Modal-root")?.getAttribute("style"),
    ).toContain("--mb-z-index: 300");
  });
});
