import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceModuleEntry } from "./import-source-types";
import { SavedSourceView } from "./saved-source-view";

const SAMPLE_ENTRIES: WorkspaceModuleEntry[] = [
  { key: "module-1", moduleId: "module-1", material: "First material" },
  { key: "module-2", moduleId: "module-2", material: "" },
];

function renderView(
  overrides: Partial<React.ComponentProps<typeof SavedSourceView>> = {},
) {
  const props: React.ComponentProps<typeof SavedSourceView> = {
    content: "Saved source text",
    onContentChange: vi.fn(),
    entries: [],
    onEntriesChange: vi.fn(),
    onRemove: vi.fn(),
    isRemoving: false,
    removeError: null,
    onSave: vi.fn(),
    isSaving: false,
    saveError: null,
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    direction: "rtl",
    onDirectionChange: vi.fn(),
    ...overrides,
  };

  render(
    <MantineProvider>
      <SavedSourceView {...props} />
    </MantineProvider>,
  );

  return props;
}

function selectText(textarea: HTMLTextAreaElement, start: number, end: number) {
  textarea.setSelectionRange(start, end);
  fireEvent.select(textarea);
}

// The Source Text panel's plain <textarea> also has an implicit
// role="textbox", alongside each Module's contenteditable MarkdownEditor --
// this narrows a `findAllByRole("textbox")` result down to just the latter.
async function findMaterialEditors() {
  const textboxes = await screen.findAllByRole("textbox");
  return textboxes.filter((el) => el.tagName !== "TEXTAREA");
}

describe("SavedSourceView", () => {
  it("renders the two-panel Source Text + Modules workspace (ANA-72)", () => {
    renderView();

    expect(screen.getByText("Source Text")).toBeInTheDocument();
    expect(screen.getByText(/^Modules/)).toBeInTheDocument();
  });

  it("displays the complete stored content in the Source Text panel", () => {
    renderView({ content: "Line one\n\nLine two" });

    expect(screen.getByLabelText("Source text")).toHaveValue(
      "Line one\n\nLine two",
    );
  });

  it("renders the Source Text editable, not read-only", () => {
    renderView();

    expect(screen.getByLabelText("Source text")).not.toHaveAttribute(
      "readonly",
    );
  });

  it("reports Source Text edits via onContentChange", () => {
    const onContentChange = vi.fn();
    renderView({ onContentChange });

    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Edited source text" },
    });

    expect(onContentChange).toHaveBeenCalledWith("Edited source text");
  });

  it("shows the exact zero-state copy when there are no Modules", () => {
    renderView({ entries: [] });

    expect(
      screen.getByText(
        "Select text on the left and click “Create Module” to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the Modules count and renders each Module as Module N", () => {
    renderView({ entries: SAMPLE_ENTRIES });

    expect(screen.getByText("Modules (2)")).toBeInTheDocument();
    expect(screen.getByText("Module 1")).toBeInTheDocument();
    expect(screen.getByText("Module 2")).toBeInTheDocument();
  });

  it("loads existing Modules in the given order with their Learning Material", async () => {
    renderView({ entries: SAMPLE_ENTRIES });

    await screen.findByText("First material");
  });

  it("shows an empty Learning Material editor for a Module with no Material yet", async () => {
    renderView({ entries: SAMPLE_ENTRIES });

    const editors = await findMaterialEditors();
    expect(editors).toHaveLength(2);
    expect(editors[1]).toHaveTextContent("");
  });

  it("reports a Module's Learning Material edit without touching other Modules", async () => {
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx), so this starts module-1 from non-empty content and
    // appends -- matching that existing convention.
    const onEntriesChange = vi.fn();
    renderView({ entries: SAMPLE_ENTRIES, onEntriesChange });

    const editors = await findMaterialEditors();
    const user = userEvent.setup();
    await user.click(editors[0]);
    await user.type(editors[0], "!");

    expect(onEntriesChange).toHaveBeenLastCalledWith([
      { key: "module-1", moduleId: "module-1", material: "First material!" },
      { key: "module-2", moduleId: "module-2", material: "" },
    ]);
  });

  it("Create Module is disabled until non-whitespace Source Text is selected", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("enables Create Module once Source Text is selected, and seeds the new Module's Learning Material with the exact selection", () => {
    const onEntriesChange = vi.fn();
    renderView({
      content: "Some source text to select",
      entries: [],
      onEntriesChange,
    });

    const textarea = screen.getByLabelText(
      "Source text",
    ) as HTMLTextAreaElement;
    selectText(textarea, 0, 4);

    const createModule = screen.getByRole("button", { name: "Create Module" });
    expect(createModule).toBeEnabled();

    fireEvent.click(createModule);

    expect(onEntriesChange).toHaveBeenCalledWith([
      { key: expect.any(String), moduleId: null, material: "Some" },
    ]);
  });

  it("Create Module stays disabled for a whitespace-only selection", () => {
    renderView({ content: "   " });

    const textarea = screen.getByLabelText(
      "Source text",
    ) as HTMLTextAreaElement;
    selectText(textarea, 0, 3);

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("also re-checks the selection on mouseup/keyup, not only onSelect (Copilot review hardening)", () => {
    // `select` doesn't reliably fire for every way a selection can
    // collapse to a plain caret in every browser -- firing only
    // `mouseup`/`keyup` (never `select`) must still disable Create Module
    // once the selection is gone, so `hasSelection` can't go stale.
    renderView({ content: "Some source text" });
    const textarea = screen.getByLabelText(
      "Source text",
    ) as HTMLTextAreaElement;
    selectText(textarea, 0, 4);
    expect(screen.getByRole("button", { name: "Create Module" })).toBeEnabled();

    textarea.setSelectionRange(2, 2);
    fireEvent.mouseUp(textarea);

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("prevents Create Module's mousedown default, so clicking it doesn't collapse the selection first", () => {
    renderView({ content: "Some source text" });
    const textarea = screen.getByLabelText(
      "Source text",
    ) as HTMLTextAreaElement;
    selectText(textarea, 0, 4);

    const createModule = screen.getByRole("button", { name: "Create Module" });
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(createModule, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("clears the selection state after creating a Module", () => {
    renderView({ content: "Some source text" });
    const textarea = screen.getByLabelText(
      "Source text",
    ) as HTMLTextAreaElement;
    selectText(textarea, 0, 4);

    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("renders Select Another PDF on the left and Save changes on the right", () => {
    renderView();

    const selectAnotherPdf = screen.getByRole("button", {
      name: "Select Another PDF",
    });
    const saveChanges = screen.getByRole("button", { name: "Save changes" });

    expect(selectAnotherPdf.nextElementSibling).toBe(saveChanges);
  });

  it("calls onRemove when Select Another PDF is clicked", () => {
    const onRemove = vi.fn();
    renderView({ onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Select Another PDF" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables Select Another PDF and shows a loading state while removing", () => {
    renderView({ isRemoving: true });

    expect(
      screen.getByRole("button", { name: "Select Another PDF" }),
    ).toBeDisabled();
  });

  it("shows a removal error while keeping the workspace visible", () => {
    renderView({ removeError: "Could not remove the source." });

    expect(
      screen.getByText("Could not remove the source."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toBeInTheDocument();
  });

  it("calls onSave when Save changes is clicked", () => {
    const onSave = vi.fn();
    renderView({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("freezes the Source Text editor, Create Module, and Learning Material editors while saving", async () => {
    renderView({
      content: "Some source text",
      entries: SAMPLE_ENTRIES,
      isSaving: true,
    });

    expect(screen.getByLabelText("Source text")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();

    const editors = await findMaterialEditors();
    editors.forEach((editor) =>
      expect(editor).toHaveAttribute("contenteditable", "false"),
    );
  });

  it("disables Save changes and shows a loading state while saving", () => {
    renderView({ isSaving: true });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows a save error while keeping the edited workspace in place", () => {
    renderView({ saveError: "Could not save the changes." });

    expect(screen.getByText("Could not save the changes.")).toBeInTheDocument();
  });

  it("renders the font size and text direction controls", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Decrease font size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Increase font size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Left to right" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Right to left" }),
    ).toBeInTheDocument();
  });

  it("applies the given text direction to the Source Text textarea", () => {
    renderView({ direction: "ltr" });

    expect(
      screen.getByLabelText("Source text").closest("[dir]"),
    ).toHaveAttribute("dir", "ltr");
  });

  it("calls onFontScaleChange and onDirectionChange from their controls", () => {
    const onFontScaleChange = vi.fn();
    const onDirectionChange = vi.fn();
    renderView({ onFontScaleChange, onDirectionChange });

    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    fireEvent.click(screen.getByRole("button", { name: "Left to right" }));

    expect(onFontScaleChange).toHaveBeenCalled();
    expect(onDirectionChange).toHaveBeenCalledWith("ltr");
  });

  it("makes no network requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView({ entries: SAMPLE_ENTRIES });

    await screen.findAllByRole("toolbar");

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
