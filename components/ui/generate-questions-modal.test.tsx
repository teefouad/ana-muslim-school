import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { GenerateQuestionsModal } from "./generate-questions-modal";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test("renders the title, source text, and additional instructions fields", () => {
  renderWithProvider(
    <GenerateQuestionsModal opened onCancel={vi.fn()} onGenerate={vi.fn()} />,
  );

  expect(
    screen.getByRole("dialog", { name: "Generate Questions" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Source text")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Additional instructions (optional)"),
  ).toBeInTheDocument();
});

test("defaults the question count to 5 and steps it via the minus/plus buttons only", () => {
  renderWithProvider(
    <GenerateQuestionsModal opened onCancel={vi.fn()} onGenerate={vi.fn()} />,
  );

  expect(screen.getByText("5")).toBeInTheDocument();
  expect(
    screen.queryByRole("spinbutton", { name: "Number of questions" }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Increase question count" }),
  );
  expect(screen.getByText("6")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Decrease question count" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Decrease question count" }),
  );
  expect(screen.getByText("4")).toBeInTheDocument();
});

test("Generate is disabled until source text is entered", () => {
  renderWithProvider(
    <GenerateQuestionsModal opened onCancel={vi.fn()} onGenerate={vi.fn()} />,
  );

  expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "A source passage." },
  });

  expect(screen.getByRole("button", { name: "Generate" })).not.toBeDisabled();
});

test("calls onGenerate with the trimmed source text, instructions, and count", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <GenerateQuestionsModal
      opened
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "  A source passage.  " },
  });
  fireEvent.change(
    screen.getByLabelText("Additional instructions (optional)"),
    { target: { value: "  Focus on the first section.  " } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Increase question count" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith({
    sourceText: "A source passage.",
    additionalInstructions: "Focus on the first section.",
    count: 6,
  });
});

test("omits additionalInstructions when left blank", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <GenerateQuestionsModal
      opened
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "A source passage." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith({
    sourceText: "A source passage.",
    additionalInstructions: undefined,
    count: 5,
  });
});

test("calls onCancel when Cancel is clicked", () => {
  const onCancel = vi.fn();

  renderWithProvider(
    <GenerateQuestionsModal opened onCancel={onCancel} onGenerate={vi.fn()} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onCancel).toHaveBeenCalled();
});

test("shows a loading state on Generate and blocks dismissal while generating", () => {
  const onCancel = vi.fn();

  renderWithProvider(
    <GenerateQuestionsModal
      opened
      isGenerating
      onCancel={onCancel}
      onGenerate={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Generate" })).toHaveAttribute(
    "data-loading",
    "true",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

  fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
  expect(onCancel).not.toHaveBeenCalled();
});

test("shows an error without clearing the entered passage or instructions (ANA-131)", () => {
  const { rerender } = renderWithProvider(
    <GenerateQuestionsModal opened onCancel={vi.fn()} onGenerate={vi.fn()} />,
  );

  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "A source passage." },
  });
  fireEvent.change(
    screen.getByLabelText("Additional instructions (optional)"),
    { target: { value: "Focus on the first section." } },
  );

  // A failed request keeps the same modal instance mounted (the caller
  // never unmounts it on error, only on success/Cancel), just flipping
  // `error` on -- exactly what this asserts, not a fresh render.
  rerender(
    <MantineProvider>
      <GenerateQuestionsModal
        opened
        error="Question generation failed. Please try again."
        onCancel={vi.fn()}
        onGenerate={vi.fn()}
      />
    </MantineProvider>,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Question generation failed. Please try again.",
  );
  expect(screen.getByLabelText("Source text")).toHaveValue("A source passage.");
  expect(
    screen.getByLabelText("Additional instructions (optional)"),
  ).toHaveValue("Focus on the first section.");
});
