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
      promptTask="assist.title"
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
      promptTask="assist.title"
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

  expect(onGenerate).toHaveBeenCalledWith(
    "Be more formal.",
    "Default base prompt for assist.title",
  );
});

test("calls onGenerate with undefined when instructions are left blank", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      promptTask="assist.title"
      title="AI Assistance"
      description="Description"
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith(
    undefined,
    "Default base prompt for assist.title",
  );
});

test("calls onCancel when Cancel is clicked", () => {
  const onCancel = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      promptTask="assist.title"
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
      promptTask="assist.title"
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

test("shows the base prompt in an editable field and submits the edit (ANA-134)", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      promptTask="assist.title"
      title="AI Assistance"
      description="Description"
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  const prompt = screen.getByLabelText("Base prompt");
  expect(prompt).toHaveValue("Default base prompt for assist.title");

  fireEvent.change(prompt, { target: { value: "My own prompt" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));

  expect(onGenerate).toHaveBeenCalledWith(undefined, "My own prompt");
});

test("can reset an edited base prompt back to the default (ANA-134)", () => {
  renderWithProvider(
    <AiInstructionsModal
      opened
      promptTask="assist.title"
      title="AI Assistance"
      description="Description"
      onCancel={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );

  const prompt = screen.getByLabelText("Base prompt");
  expect(
    screen.queryByRole("button", { name: "Reset to default" }),
  ).not.toBeInTheDocument();

  fireEvent.change(prompt, { target: { value: "Changed" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

  expect(prompt).toHaveValue("Default base prompt for assist.title");
});

test("hides the instructions field but still shows the prompt when showInstructions is off", () => {
  const onGenerate = vi.fn();

  renderWithProvider(
    <AiInstructionsModal
      opened
      promptTask="translate.plain"
      showInstructions={false}
      title="Translate with AI"
      description="Description"
      generateLabel="Translate"
      onCancel={vi.fn()}
      onGenerate={onGenerate}
    />,
  );

  expect(
    screen.queryByLabelText("Additional instructions or context (optional)"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Base prompt")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Translate" }));

  expect(onGenerate).toHaveBeenCalledWith(
    undefined,
    "Default base prompt for translate.plain",
  );
});
