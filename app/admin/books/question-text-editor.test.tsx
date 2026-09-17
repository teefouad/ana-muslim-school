import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  QuestionTextEditor,
  type QuestionTextEditorProps,
} from "./question-text-editor";
import {
  makeQuestionFieldEntry,
  type QuestionFieldEntry,
} from "./question-fields";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// QuestionTextEditor is fully controlled (no state of its own) -- wraps it
// with local state so a sequence of interactions (type, switch language,
// translate) actually reflects back into what's rendered, the same way
// lesson-form.stories.tsx's LessonFormDemo does for LessonForm.
function renderEditor(overrides: Partial<QuestionTextEditorProps> = {}) {
  const onChange = vi.fn();

  function Demo({
    question: initialQuestion,
    onChange: onChangeProp,
    ...rest
  }: QuestionTextEditorProps) {
    const [question, setQuestion] = useState(initialQuestion);
    return (
      <QuestionTextEditor
        {...rest}
        question={question}
        onChange={(updated) => {
          setQuestion(updated);
          onChangeProp(updated);
        }}
      />
    );
  }

  const utils = render(
    <MantineProvider>
      <Demo
        question={makeQuestionFieldEntry()}
        onChange={onChange}
        {...overrides}
      />
    </MantineProvider>,
  );
  return { onChange, ...utils };
}

describe("QuestionTextEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("parses question -> explanation -> choices from the Arabic textarea", () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByRole("textbox", { name: "Question" }), {
      target: {
        value: "ما هي الصلاة؟\n\nشرح\n\n[ ] أ\n[x] ب",
      },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: { ar: "ما هي الصلاة؟" },
        explanation: { ar: "شرح" },
        choices: [
          { text: { ar: "أ" }, isCorrect: false },
          { text: { ar: "ب" }, isCorrect: true },
        ],
      }),
    );
  });

  it("keeps the Arabic and English buffers independently editable", () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByRole("textbox", { name: "Question" }), {
      target: { value: "عربي" },
    });

    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Question" }), {
      target: { value: "English" },
    });

    // Editing the English buffer only ever updates `en`, leaving the
    // already-entered Arabic side untouched.
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: { ar: "عربي", en: "English" } }),
    );
  });

  it("shows an inline error for a malformed choice marker without discarding the raw text", () => {
    renderEditor();

    fireEvent.change(screen.getByRole("textbox", { name: "Question" }), {
      target: { value: "Q?\n\n[x]a" },
    });

    expect(screen.getByText(/choices must start with/i)).toBeInTheDocument();
    // The raw buffer still holds the exact, unmodified invalid input.
    expect(screen.getByRole("textbox", { name: "Question" })).toHaveValue(
      "Q?\n\n[x]a",
    );
  });

  it("recovers once the malformed choice marker is fixed", () => {
    renderEditor();

    const textarea = screen.getByRole("textbox", { name: "Question" });
    fireEvent.change(textarea, { target: { value: "Q?\n\n[x]a" } });
    expect(screen.getByText(/choices must start with/i)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "Q?\n\n[x] a" } });
    expect(
      screen.queryByText(/choices must start with/i),
    ).not.toBeInTheDocument();
  });

  it("disables Translate when the Arabic question text is empty", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: /translate/i })).toBeDisabled();
  });

  it("translates Arabic text/explanation/choices to English, preserving correctness flags", async () => {
    const question: QuestionFieldEntry = {
      ...makeQuestionFieldEntry(),
      rawText: { ar: "سؤال\n\nشرح\n\n[x] صحيح\n[ ] خطأ" },
      text: { ar: "سؤال" },
      explanation: { ar: "شرح" },
      choices: [
        { text: { ar: "صحيح" }, isCorrect: true },
        { text: { ar: "خطأ" }, isCorrect: false },
      ],
    };

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string) as {
          text: string;
        };
        return jsonResponse({ data: { text: `${body.text} (en)` } });
      },
    );

    const { onChange } = renderEditor({ question });

    fireEvent.click(screen.getByRole("button", { name: /translate/i }));

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          text: { ar: "سؤال", en: "سؤال (en)" },
          explanation: { ar: "شرح", en: "شرح (en)" },
          choices: [
            { text: { ar: "صحيح", en: "صحيح (en)" }, isCorrect: true },
            { text: { ar: "خطأ", en: "خطأ (en)" }, isCorrect: false },
          ],
        }),
      ),
    );
  });

  it("surfaces a Translate failure without losing the current draft", async () => {
    const question: QuestionFieldEntry = {
      ...makeQuestionFieldEntry(),
      rawText: { ar: "سؤال" },
      text: { ar: "سؤال" },
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Translation failed." }, 500),
    );

    renderEditor({ question });

    fireEvent.click(screen.getByRole("button", { name: /translate/i }));

    expect(await screen.findByText("Translation failed.")).toBeInTheDocument();
  });

  it("reports translate busy state through onTranslatingChange", async () => {
    const question: QuestionFieldEntry = {
      ...makeQuestionFieldEntry(),
      rawText: { ar: "سؤال" },
      text: { ar: "سؤال" },
    };

    let resolveTranslate: (value: Response) => void = () => {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (resolveTranslate = resolve)),
    );
    const onTranslatingChange = vi.fn();

    renderEditor({ question, onTranslatingChange });

    fireEvent.click(screen.getByRole("button", { name: /translate/i }));

    await vi.waitFor(() =>
      expect(onTranslatingChange).toHaveBeenCalledWith(true),
    );

    resolveTranslate(jsonResponse({ data: { text: "en" } }));

    await vi.waitFor(() =>
      expect(onTranslatingChange).toHaveBeenCalledWith(false),
    );
  });
});
