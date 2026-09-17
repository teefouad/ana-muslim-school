import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  toQuestionFieldEntry,
  type QuestionFieldEntry,
} from "./question-fields";
import { buildQuestionFixture } from "./question-fixtures";
import { QuestionsEditor, type QuestionsEditorProps } from "./questions-editor";

const QUESTIONS: QuestionFieldEntry[] = [
  toQuestionFieldEntry(
    buildQuestionFixture({
      id: "question-1",
      text: { ar: "سؤال أول", en: "First question" },
    }),
  ),
  toQuestionFieldEntry(
    buildQuestionFixture({
      id: "question-2",
      text: { ar: "سؤال ثاني", en: "Second question" },
    }),
  ),
];

// QuestionsEditor is fully controlled -- wraps it with local state so
// reorder/collapse/delete interactions actually reflect back into what's
// rendered, the same way lesson-break-config.test.tsx doesn't need to (its
// own tests only ever assert the single onChange call) but reorder/collapse
// tests here do.
function renderEditor(overrides: Partial<QuestionsEditorProps> = {}) {
  const onChange = vi.fn();

  function Demo({
    questions: initialQuestions,
    onChange: onChangeProp,
    ...rest
  }: QuestionsEditorProps) {
    const [questions, setQuestions] = useState(initialQuestions);
    return (
      <QuestionsEditor
        {...rest}
        questions={questions}
        onChange={(updated) => {
          setQuestions(updated);
          onChangeProp(updated);
        }}
      />
    );
  }

  const utils = render(
    <MantineProvider>
      <Demo questions={QUESTIONS} onChange={onChange} {...overrides} />
    </MantineProvider>,
  );
  return { onChange, ...utils };
}

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// ported from lesson-break-config.test.tsx's identical helper.
function stubItemRects(order: string[], itemHeight = 60) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const container = this.closest('[data-testid^="question-card-"]');
      const id = container
        ?.getAttribute("data-testid")
        ?.replace("question-card-", "");
      const index = id ? order.indexOf(id) : -1;
      const top = index === -1 ? 0 : index * itemHeight;
      return {
        top,
        bottom: top + itemHeight,
        left: 0,
        right: 300,
        width: 300,
        height: itemHeight,
        x: 0,
        y: top,
        toJSON() {},
      } as DOMRect;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuestionsEditor", () => {
  it("shows the Questions header with New/Insert/Generate in order", () => {
    renderEditor();

    const buttons = screen.getAllByRole("button", {
      name: /^(New|Insert|Generate)$/,
    });
    expect(buttons.map((button) => button.textContent)).toEqual([
      "New",
      "Insert",
      "Generate",
    ]);
  });

  it("renders New/Insert/Generate with Plus/ListPlus/Sparkles icons", () => {
    renderEditor();

    expect(
      screen.getByRole("button", { name: "New" }).querySelector("svg"),
    ).toHaveClass("lucide-plus");
    expect(
      screen.getByRole("button", { name: "Insert" }).querySelector("svg"),
    ).toHaveClass("lucide-list-plus");
    expect(
      screen.getByRole("button", { name: "Generate" }).querySelector("svg"),
    ).toHaveClass("lucide-sparkles");
  });

  it("keeps Insert and Generate present but disabled", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "Insert" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New" })).not.toBeDisabled();
  });

  it("shows the exact empty-state copy when there are no questions", () => {
    renderEditor({ questions: [] });

    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
  });

  it("New adds a new, expanded Question card", () => {
    const { onChange } = renderEditor({ questions: [] });

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    // Expanded: the structured textarea is visible immediately.
    expect(
      screen.getByRole("textbox", { name: "Question" }),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: null, text: {} }),
    ]);
  });

  it("shows Question N, a drag handle, a chevron, and a delete action for each card", () => {
    renderEditor();

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Reorder question 1" })
        .querySelector("svg"),
    ).toHaveClass("lucide-grip-vertical");
    expect(
      screen
        .getByRole("button", { name: "Question 1", expanded: true })
        .querySelector("svg"),
    ).toHaveClass("lucide-chevron-down");
    expect(
      screen
        .getByRole("button", { name: "Remove question 1" })
        .querySelector("svg"),
    ).toHaveClass("lucide-trash-2");
  });

  it("collapsing a card hides its editor and shows a one-line text summary", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Question 1" }));

    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox", { name: "Question" })).toHaveLength(
      1,
    );
  });

  it("keeps a card's collapse state stable across an edit to a different card", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Question 1" }));
    expect(screen.getByText("سؤال أول")).toBeInTheDocument();

    const [secondTextarea] = screen.getAllByRole("textbox", {
      name: "Question",
    });
    fireEvent.change(secondTextarea, { target: { value: "معدّل" } });

    // Question 1 stays collapsed; its summary is unaffected.
    expect(screen.getByText("سؤال أول")).toBeInTheDocument();
  });

  it("reorders questions via the keyboard, updating numbering/order", async () => {
    const { onChange } = renderEditor();
    stubItemRects(["question-1", "question-2"]);

    const grip = screen.getByRole("button", { name: "Reorder question 2" });
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onChange).toHaveBeenCalledWith([QUESTIONS[1], QUESTIONS[0]]);
  });

  it("removes a question after confirming, detaching it from the list", () => {
    const { onChange } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    const dialog = screen.getByRole("dialog", { name: "Delete question 1?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(onChange).toHaveBeenCalledWith([QUESTIONS[1]]);
    expect(screen.queryByText("سؤال أول")).not.toBeInTheDocument();
  });

  it("cancelling the delete confirmation keeps the question", () => {
    const { onChange } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    const dialog = screen.getByRole("dialog", { name: "Delete question 1?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
  });
});
