import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  toQuestionFieldEntry,
  type QuestionFieldEntry,
} from "./question-fields";
import { buildQuestionFixture } from "./question-fixtures";
import { QuestionsEditor, type QuestionsEditorProps } from "./questions-editor";

const { generateQuestionsMock } = vi.hoisted(() => ({
  generateQuestionsMock: vi.fn(),
}));

vi.mock("./generate-questions-client", () => ({
  generateQuestions: generateQuestionsMock,
}));

const QUESTION_1 = buildQuestionFixture({
  id: "question-1",
  text: { ar: "سؤال أول", en: "First question" },
});
const QUESTION_2 = buildQuestionFixture({
  id: "question-2",
  text: { ar: "سؤال ثاني", en: "Second question" },
});
// Not yet linked into the Lesson -- available for Insert to pick (ANA-120).
const QUESTION_3 = buildQuestionFixture({
  id: "question-3",
  text: { ar: "سؤال ثالث", en: "Third question" },
});

const QUESTIONS: QuestionFieldEntry[] = [
  toQuestionFieldEntry(QUESTION_1),
  toQuestionFieldEntry(QUESTION_2),
];

// The owning Module's own Question bank -- includes both Questions already
// linked into `QUESTIONS` above (so Insert's exclusion is exercised) and
// one more available to insert.
const MODULE_QUESTIONS = [QUESTION_1, QUESTION_2, QUESTION_3];

// A previous Module's own Question bank (ANA-120) -- also offered by
// Insert, but copied into a new draft on selection rather than referenced
// directly (the School schema requires `Lesson.questions` ids to resolve
// under the Lesson's own Module).
const PREVIOUS_QUESTION = buildQuestionFixture({
  id: "previous-question-1",
  text: { ar: "سؤال من وحدة سابقة", en: "A previous-Module question" },
});
const PREVIOUS_MODULE_QUESTIONS = [
  { moduleId: "module-0", questions: [PREVIOUS_QUESTION] },
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
      <Demo
        questions={QUESTIONS}
        onChange={onChange}
        moduleQuestions={MODULE_QUESTIONS}
        previousModuleQuestions={PREVIOUS_MODULE_QUESTIONS}
        {...overrides}
      />
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
  generateQuestionsMock.mockReset();
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

  it("keeps New, Insert, and Generate all enabled", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "New" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Insert" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate" })).not.toBeDisabled();
  });

  it("styles New/Insert/Generate as compact text actions, not button chrome (ANA-120)", () => {
    renderEditor();

    for (const name of ["New", "Insert", "Generate"]) {
      const button = screen.getByRole("button", { name });
      // Plain <button> elements styled through a CSS Module class, not a
      // Mantine `Button` (which always renders `.mantine-Button-root`).
      expect(button.tagName).toBe("BUTTON");
      expect(button.className).not.toMatch(/mantine-Button-root/);
    }
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

  describe("Insert (ANA-120)", () => {
    it("opens the Insert a question picker, listing eligible Module Questions and excluding already-linked ones", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));

      expect(
        screen.getByRole("dialog", { name: "Insert a question" }),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search questions…"),
      ).toBeInTheDocument();
      // question-1/question-2 are already in the Lesson -- only question-3
      // (not yet linked) is offered.
      expect(screen.queryByText("سؤال أول")).not.toBeInTheDocument();
      expect(screen.getByText("سؤال ثالث")).toBeInTheDocument();
    });

    it("filters results by Arabic and English question text", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
      fireEvent.change(screen.getByPlaceholderText("Search questions…"), {
        target: { value: "Third" },
      });

      expect(screen.getByText("سؤال ثالث")).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText("Search questions…"), {
        target: { value: "no match" },
      });

      expect(screen.getByText("No questions found.")).toBeInTheDocument();
    });

    it("opening and closing Insert without selecting a question never calls onChange", () => {
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
      const dialog = screen.getByRole("dialog", { name: "Insert a question" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Insert a question" }),
      ).not.toBeInTheDocument();
    });

    it("selecting a question appends it (reusing its persisted id), closes the picker, and shows it expanded", () => {
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
      fireEvent.click(screen.getByRole("option", { name: /سؤال ثالث/ }));

      expect(
        screen.queryByRole("dialog", { name: "Insert a question" }),
      ).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith([
        ...QUESTIONS,
        expect.objectContaining({ id: "question-3" }),
      ]);
      // Newly inserted, so it renders expanded (its structured editor is
      // visible) rather than collapsed, consistent with a newly added New
      // entry -- alongside the two already-expanded existing cards.
      expect(screen.getByText("Question 3")).toBeInTheDocument();
      expect(screen.getAllByRole("textbox", { name: "Question" })).toHaveLength(
        3,
      );
    });

    it("also lists Questions from previous Modules alongside the current Module's own", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));

      expect(screen.getByText("سؤال ثالث")).toBeInTheDocument();
      expect(screen.getByText("سؤال من وحدة سابقة")).toBeInTheDocument();
    });

    it("selecting a previous-Module Question copies its content into a new, unpersisted draft", () => {
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
      fireEvent.click(
        screen.getByRole("option", { name: /سؤال من وحدة سابقة/ }),
      );

      expect(onChange).toHaveBeenCalledWith([
        ...QUESTIONS,
        expect.objectContaining({
          id: null,
          text: { ar: "سؤال من وحدة سابقة", en: "A previous-Module question" },
          sourceModuleId: "module-0",
          sourceQuestionId: "previous-question-1",
        }),
      ]);
    });

    it("excludes a previous-Module Question already inserted this session from being offered again", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
      fireEvent.click(
        screen.getByRole("option", { name: /سؤال من وحدة سابقة/ }),
      );

      // Re-open Insert -- the same source Question is no longer offered,
      // even though its local copy still has no persisted id to exclude by.
      fireEvent.click(screen.getByRole("button", { name: "Insert" }));

      expect(screen.queryByText("سؤال من وحدة سابقة")).not.toBeInTheDocument();
    });
  });

  describe("Generate (ANA-131)", () => {
    it("opens the Generate Questions modal", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(
        screen.getByRole("dialog", { name: "Generate Questions" }),
      ).toBeInTheDocument();
    });

    it("generating appends the returned questions, expanded, and closes the modal", async () => {
      generateQuestionsMock.mockResolvedValue([
        {
          text: "سؤال مولّد",
          explanation: "شرح",
          choices: [
            { text: "خطأ", isCorrect: false },
            { text: "صحيح", isCorrect: true },
          ],
        },
      ]);
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
      const dialog = screen.getByRole("dialog", { name: "Generate Questions" });
      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "نص المصدر" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Generate Questions" }),
        ).not.toBeInTheDocument(),
      );

      expect(generateQuestionsMock).toHaveBeenCalledWith({
        sourceText: "نص المصدر",
        additionalInstructions: undefined,
        basePrompt: "Default base prompt for generateQuestions",
        count: 5,
      });
      expect(onChange).toHaveBeenCalledWith([
        ...QUESTIONS,
        expect.objectContaining({
          id: null,
          text: { ar: "سؤال مولّد" },
        }),
      ]);
      // Newly generated, so it renders expanded, consistent with New/Insert.
      expect(screen.getByText("Question 3")).toBeInTheDocument();
    });

    it("a failed generation shows the error and keeps the modal open with the entered passage", async () => {
      generateQuestionsMock.mockRejectedValue(
        new Error("Question generation failed. Please try again."),
      );
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
      const dialog = screen.getByRole("dialog", { name: "Generate Questions" });
      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "نص المصدر" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Question generation failed. Please try again.",
        ),
      );

      expect(
        screen.getByRole("dialog", { name: "Generate Questions" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Source text")).toHaveValue("نص المصدر");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("cancelling the modal without generating never calls onChange", () => {
      const { onChange } = renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Generate Questions" }),
      ).not.toBeInTheDocument();
    });
  });
});
