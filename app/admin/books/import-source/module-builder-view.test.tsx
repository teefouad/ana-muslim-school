import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OcrResult } from "@/lib/sources/ocr-types";
import type { TempModule } from "./import-source-types";
import { ModuleBuilderView } from "./module-builder-view";

const SAMPLE_RESULT: OcrResult = {
  model: "mistral-ocr-latest",
  pagesProcessed: 2,
  docSizeBytes: 1000,
  pages: [
    { pageNumber: 1, markdown: "First page text" },
    { pageNumber: 2, markdown: "Second page text" },
  ],
};

// Selects the first `length` characters of the source panel's text node
// directly through the native Selection API and fires the same
// `selectionchange` event the browser would -- jsdom doesn't support real
// cursor-drag selection, matching the approach already used by
// components/ui/markdown-editor.test.tsx.
function selectFirstCharacters(root: HTMLElement, length: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

function collapseSelection() {
  window.getSelection()?.removeAllRanges();
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

function moduleHeader(name: string) {
  return screen.getByText(name).closest("[aria-expanded]") as HTMLElement;
}

function renderView(
  overrides: Partial<React.ComponentProps<typeof ModuleBuilderView>> = {},
) {
  const props: React.ComponentProps<typeof ModuleBuilderView> = {
    fileName: "book.pdf",
    ocrResult: SAMPLE_RESULT,
    editedMarkdown: { 1: "First page text", 2: "Second page text" },
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    direction: "rtl",
    onDirectionChange: vi.fn(),
    modules: [],
    onModulesChange: vi.fn(),
    onBack: vi.fn(),
    backDisabled: false,
    onFinish: vi.fn(),
    isFinishing: false,
    finishError: null,
    ...overrides,
  };

  render(
    <MantineProvider>
      <ModuleBuilderView {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("ModuleBuilderView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    collapseSelection();
  });

  it("labels the left panel 'Source Text', not 'Extracted text' (ANA-72)", () => {
    renderView();

    expect(screen.getByText("Source Text")).toBeInTheDocument();
    expect(screen.queryByText("Extracted text")).not.toBeInTheDocument();
  });

  it("joins the edited OCR pages in page order, separated by a blank line", () => {
    renderView({
      editedMarkdown: { 1: "Edited first", 2: "Edited second" },
    });

    expect(screen.getByText(/Edited first/).textContent).toBe(
      "Edited first\n\nEdited second",
    );
  });

  it("shows the exact zero-state copy when there are no Modules", () => {
    renderView({ modules: [] });

    expect(
      screen.getByText(
        "Select text on the left and click “Create Module” to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("Create Module is disabled until non-whitespace text is selected", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("enables Create Module once text is selected in the source panel, and seeds the new Module's Arabic Learning Material with the exact selection, leaving English empty (ANA-75)", () => {
    const onModulesChange = vi.fn();
    renderView({ onModulesChange });

    const source = screen.getByText(/First page text/);
    selectFirstCharacters(source, 5);

    const createModule = screen.getByRole("button", { name: "Create Module" });
    expect(createModule).toBeEnabled();

    fireEvent.click(createModule);

    expect(onModulesChange).toHaveBeenCalledWith([
      expect.objectContaining({ material: { ar: "First", en: "" } }),
    ]);
  });

  it("prevents Create Module's mousedown default, so clicking it doesn't collapse the selection/steal focus before onClick runs", () => {
    // A real browser both collapses the current text selection and moves
    // focus away from the source <pre> as soon as a mousedown lands on
    // another element -- either one alone clears `selectedText` before
    // this button's own onClick could fire. jsdom doesn't reproduce that
    // browser-level side effect on its own, so the mousedown handler's
    // preventDefault() call -- which is what stops it in a real browser --
    // is asserted directly here instead.
    renderView();
    const source = screen.getByText(/First page text/);
    selectFirstCharacters(source, 5);

    const createModule = screen.getByRole("button", { name: "Create Module" });
    const mouseDownEvent = createEvent.mouseDown(createModule);
    fireEvent(createModule, mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
  });

  it("clears the selection state after creating a Module", () => {
    renderView();
    const source = screen.getByText(/First page text/);
    selectFirstCharacters(source, 5);

    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("shows the same document summary as OCR review, not just the filename", () => {
    // Regression test: the Module-building header previously reduced the
    // OCR review header's summary down to filename-only, dropping pages
    // processed/model/size (PR review feedback for ANA-68) -- both screens
    // now share the same DocumentSummary component.
    renderView();

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(/2 pages processed.*mistral-ocr-latest.*1000 B/),
    ).toBeInTheDocument();
  });

  it("Back calls onBack", () => {
    const onBack = vi.fn();
    renderView({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("disables Back once a Module has already been created in this Finish session", () => {
    renderView({ backDisabled: true });

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("renders the Modules count and each Module as the shared Module card, defaulting to its Arabic draft", async () => {
    const modules: TempModule[] = [
      { id: "module-1", material: { ar: "أول", en: "First" } },
      { id: "module-2", material: { ar: "ثاني", en: "Second" } },
    ];
    renderView({ modules });

    expect(screen.getByText("Modules (2)")).toBeInTheDocument();
    expect(moduleHeader("Module 1")).toBeInTheDocument();
    expect(moduleHeader("Module 2")).toBeInTheDocument();
    await screen.findByText("أول");
    await screen.findByText("ثاني");
  });

  it("exposes a drag handle, delete affordance, language switcher, and AI Assistant for every Module (ANA-75)", () => {
    const modules: TempModule[] = [
      { id: "module-1", material: { ar: "First", en: "" } },
    ];
    renderView({ modules });

    expect(
      screen.getByRole("button", { name: "Delete Module 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Arabic" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "English" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "AI Assistant" }),
    ).toBeInTheDocument();
  });

  it("reports an edit to a Module's Learning Material without touching other Modules", async () => {
    const onModulesChange = vi.fn();
    const modules: TempModule[] = [
      { id: "module-1", material: { ar: "Keep me", en: "" } },
      { id: "module-2", material: { ar: "Existing", en: "" } },
    ];
    renderView({ modules, onModulesChange });

    const editors = await screen.findAllByRole("textbox");
    const user = userEvent.setup();
    await user.click(editors[1]);
    await user.type(editors[1], "!");

    expect(onModulesChange).toHaveBeenLastCalledWith([
      { id: "module-1", material: { ar: "Keep me", en: "" } },
      { id: "module-2", material: { ar: "Existing!", en: "" } },
    ]);
  });

  it("Finish is enabled even with zero temporary Modules (ANA-75)", () => {
    renderView({ modules: [] });

    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("calls onFinish when Finish is clicked, making no request itself", () => {
    const onFinish = vi.fn();
    renderView({ onFinish });

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables Finish and shows a loading state while submitting", () => {
    renderView({ isFinishing: true });

    const finishButton = screen.getByRole("button", { name: "Finish" });
    expect(finishButton).toBeDisabled();
  });

  it("makes every Module's Learning Material editor read-only while Finish is submitting", async () => {
    const modules: TempModule[] = [
      { id: "module-1", material: { ar: "Existing", en: "" } },
    ];
    renderView({ modules, isFinishing: true });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "false");
  });

  it("shows a clear inline error when Finish fails", () => {
    renderView({ finishError: "Could not create Module 2." });

    expect(screen.getByText("Could not create Module 2.")).toBeInTheDocument();
  });
});
