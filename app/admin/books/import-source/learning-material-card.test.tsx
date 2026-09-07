import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TempModule } from "./import-source-types";
import { LearningMaterialCard } from "./learning-material-card";

const SAMPLE_MODULE: TempModule = {
  id: "module-1",
  text: "Extracted source content",
};

function renderCard(
  overrides: Partial<React.ComponentProps<typeof LearningMaterialCard>> = {},
) {
  const props: React.ComponentProps<typeof LearningMaterialCard> = {
    module: SAMPLE_MODULE,
    index: 0,
    learningMaterial: "",
    onLearningMaterialChange: vi.fn(),
    direction: "rtl",
    fontScale: 100,
    ...overrides,
  };

  render(
    <MantineProvider>
      <LearningMaterialCard {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("LearningMaterialCard", () => {
  it("labels the card with its 1-based Module index", () => {
    renderCard({ index: 2 });

    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("is expanded by default, showing the source text and the Markdown editor", async () => {
    renderCard();

    expect(screen.getByText("Source text")).toBeInTheDocument();
    expect(screen.getByText("Extracted source content")).toBeInTheDocument();
    expect(screen.getByText("Learning material")).toBeInTheDocument();
    await screen.findByRole("toolbar");
  });

  it("collapses and re-expands when the header is clicked", async () => {
    renderCard();

    await screen.findByRole("toolbar");
    const header = screen.getByRole("button", { name: "Module 1" });

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Learning material")).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Learning material")).toBeInTheDocument();
  });

  it("renders the source text read-only, preserving whitespace/newlines", () => {
    renderCard({ module: { id: "module-1", text: "Line one\nLine two" } });

    const source = screen.getByText(
      (_, element) =>
        element?.tagName === "PRE" &&
        element.textContent === "Line one\nLine two",
    );
    expect(source.tagName).toBe("PRE");
    expect(source).not.toHaveAttribute("contenteditable");
    expect(source).not.toHaveAttribute("role", "textbox");
  });

  it("initializes the Learning Material editor empty for the Module", async () => {
    renderCard({ learningMaterial: "" });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveTextContent("");
  });

  it("reports edits via onLearningMaterialChange", async () => {
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx's own tests, which only ever type onto existing content),
    // so this starts from non-empty content and appends -- matching that
    // existing convention -- rather than exercising the from-empty case
    // here.
    const onLearningMaterialChange = vi.fn();
    renderCard({
      learningMaterial: "Existing notes",
      onLearningMaterialChange,
    });

    const editable = await screen.findByRole("textbox");
    const user = userEvent.setup();
    await user.click(editable);
    await user.type(editable, "!");

    expect(onLearningMaterialChange).toHaveBeenLastCalledWith(
      "Existing notes!",
      false,
    );
  });

  it("uses the given text direction for both the source text and the editor", async () => {
    renderCard({ direction: "ltr" });

    expect(screen.getByText("Extracted source content")).toHaveAttribute(
      "dir",
      "ltr",
    );
    const editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });
});
