import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceModuleCard } from "./source-module-card";

function renderCard(
  overrides: Partial<React.ComponentProps<typeof SourceModuleCard>> = {},
) {
  const props: React.ComponentProps<typeof SourceModuleCard> = {
    index: 0,
    material: "",
    onMaterialChange: vi.fn(),
    direction: "rtl",
    fontScale: 100,
    ...overrides,
  };

  render(
    <MantineProvider>
      <SourceModuleCard {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("SourceModuleCard", () => {
  it("labels the card with its 1-based Module index", () => {
    renderCard({ index: 2 });

    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("is expanded by default, showing the Markdown editor", async () => {
    renderCard();

    await screen.findByRole("toolbar");
  });

  it("collapses and re-expands when the header is clicked", async () => {
    renderCard();

    await screen.findByRole("toolbar");
    const header = screen.getByRole("button", { name: "Module 1" });

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("never shows source text -- only the Learning Material editor (ANA-72)", async () => {
    renderCard({ material: "Learning content" });

    await screen.findByText("Learning content");
    expect(screen.queryByText("Source text")).not.toBeInTheDocument();
  });

  it("initializes the editor empty when the Module has no Material yet", async () => {
    renderCard({ material: "" });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveTextContent("");
  });

  it("reports edits via onMaterialChange", async () => {
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx), so this starts from non-empty content and appends.
    const onMaterialChange = vi.fn();
    renderCard({ material: "Existing notes", onMaterialChange });

    const editable = await screen.findByRole("textbox");
    const user = userEvent.setup();
    await user.click(editable);
    await user.type(editable, "!");

    expect(onMaterialChange).toHaveBeenLastCalledWith("Existing notes!", false);
  });

  it("scales the editor's font size", () => {
    renderCard({ fontScale: 150 });

    const editorScale = screen.getByTestId("source-module-editor-scale");
    expect(editorScale).toHaveStyle({ fontSize: "21px" });
  });

  it("uses the given text direction for the editor", async () => {
    renderCard({ direction: "ltr" });

    const editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });

  it("makes the editor read-only when disabled", async () => {
    renderCard({ material: "Existing notes", disabled: true });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "false");
  });

  it("leaves the editor editable by default", async () => {
    renderCard({ material: "Existing notes" });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "true");
  });
});
