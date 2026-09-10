import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AiInstructionsModal } from "./ai-instructions-modal";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

test("renders the title and description", () => {
  renderWithProvider(
    <AiInstructionsModal
      opened
      title="AI Assistance"
      description="The AI will rewrite this field's current text."
      onCancel={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("dialog", { name: "AI Assistance" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("The AI will rewrite this field's current text."),
  ).toBeInTheDocument();
});

test("calls onGenerate with trimmed instructions", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      title="AI Assistance"
      description="Description"
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  fireEvent.change(
    screen.getByLabelText("Additional instructions or context (optional)"),
    { target: { value: "  Be more formal.  " } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith("Be more formal.");
});

test("calls onGenerate with undefined when instructions are left blank", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      title="AI Assistance"
      description="Description"
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith(undefined);
});

test("calls onCancel when Cancel is clicked", () => {
  const onCancel = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      title="AI Assistance"
      description="Description"
      onCancel={onCancel}
      onGenerate={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onCancel).toHaveBeenCalled();
});

test("supports custom cancel/generate labels", () => {
  renderWithProvider(
    <AiInstructionsModal
      opened
      title="Translate with AI"
      description="Description"
      cancelLabel="Never mind"
      generateLabel="Translate"
      onCancel={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Never mind" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Translate" })).toBeInTheDocument();
});
