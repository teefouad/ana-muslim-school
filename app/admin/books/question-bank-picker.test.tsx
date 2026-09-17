import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { buildQuestionFixture } from "./question-fixtures";
import { QuestionBankPicker } from "./question-bank-picker";

const QUESTION_1 = buildQuestionFixture({
  id: "question-1",
  text: { ar: "سؤال أول", en: "First question" },
});
const QUESTION_2 = buildQuestionFixture({
  id: "question-2",
  text: { ar: "سؤال ثاني", en: "Second question" },
});

function renderPicker(
  overrides: Partial<Parameters<typeof QuestionBankPicker>[0]> = {},
) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MantineProvider>
      <QuestionBankPicker
        opened
        questions={[QUESTION_1, QUESTION_2]}
        excludeQuestionIds={[]}
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

  it("lists eligible Questions with an empty query", () => {
    renderPicker();

    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
    expect(screen.getByText("سؤال ثاني")).toBeInTheDocument();
  });

  it("excludes already-linked Question ids", () => {
    renderPicker({ excludeQuestionIds: ["question-1"] });

    expect(screen.queryByText("سؤال أول")).not.toBeInTheDocument();
    expect(screen.getByText("سؤال ثاني")).toBeInTheDocument();
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

  it("Cancel closes without selecting anything", () => {
    const { onSelect, onClose } = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selecting a result calls onSelect with the full Question", () => {
    const { onSelect } = renderPicker();

    fireEvent.click(screen.getByRole("option", { name: /سؤال ثاني/ }));

    expect(onSelect).toHaveBeenCalledWith(QUESTION_2);
  });

  it("scopes its dialog/search roles correctly", () => {
    renderPicker();

    const dialog = screen.getByRole("dialog", { name: "Insert a question" });
    expect(
      within(dialog).getByRole("listbox", { name: "Questions" }),
    ).toBeInTheDocument();
  });
});
