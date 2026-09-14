import { useState } from "react";
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

const { translateArabicToEnglishMock, assistLearningMaterialMock } = vi.hoisted(
  () => ({
    translateArabicToEnglishMock: vi.fn(),
    assistLearningMaterialMock: vi.fn(),
  }),
);

vi.mock("./translate-client", () => ({
  translateArabicToEnglish: translateArabicToEnglishMock,
}));

vi.mock("./ai-assist-client", () => ({
  assistLearningMaterial: assistLearningMaterialMock,
}));

const { ModuleBuilderView } = await import("./module-builder-view");

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
    bookId: "book-1",
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
    createdModuleIds: new Set(),
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

// `onModulesChange` now accepts either a plain array or a functional
// updater (see ModuleBuilderViewProps -- ANA-77, PR review) -- this
// resolves a mock's last call against a known "current" array either way.
function applyLastModulesUpdate(
  onModulesChange: ReturnType<typeof vi.fn>,
  current: TempModule[],
): TempModule[] {
  const arg = onModulesChange.mock.calls.at(-1)?.[0];
  return typeof arg === "function" ? arg(current) : arg;
}

// A stateful wrapper for scenarios that need `modules` to genuinely persist
// across renders -- e.g. verifying a concurrent edit to one temporary
// Module survives a *different* Module's in-flight Translate request
// resolving later (PR review, blocking). `renderView`'s plain `vi.fn()`
// mock can't model this: it never feeds a result back into `modules`.
function renderStatefulView(
  overrides: Partial<React.ComponentProps<typeof ModuleBuilderView>> & {
    modules: TempModule[];
  },
) {
  function Wrapper() {
    const [modules, setModules] = useState(overrides.modules);

    return (
      <ModuleBuilderView
        bookId="book-1"
        fileName="book.pdf"
        ocrResult={SAMPLE_RESULT}
        editedMarkdown={{ 1: "First page text", 2: "Second page text" }}
        fontScale={100}
        onFontScaleChange={vi.fn()}
        direction="rtl"
        onDirectionChange={vi.fn()}
        onBack={vi.fn()}
        backDisabled={false}
        createdModuleIds={new Set()}
        onFinish={vi.fn()}
        isFinishing={false}
        finishError={null}
        {...overrides}
        modules={modules}
        onModulesChange={setModules}
      />
    );
  }

  render(
    <MantineProvider>
      <Wrapper />
    </MantineProvider>,
  );
}

describe("ModuleBuilderView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    translateArabicToEnglishMock.mockClear();
    assistLearningMaterialMock.mockClear();
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

  it("disables Back while Finish is in flight, even when backDisabled is false (PR review, ANA-75)", () => {
    // Back would otherwise move the workflow to OCR review while a Finish
    // request already started is still running.
    renderView({ isFinishing: true, backDisabled: false });

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("disables Create Module while Finish is in flight, even with a valid selection (PR review, ANA-75)", () => {
    // Finish operates on the `modules` snapshot it was invoked with -- a
    // Module created mid-request would show a draft that was never part of
    // that Finish attempt and then vanishes once it succeeds and resets
    // the modal.
    renderView({ isFinishing: true });
    const source = screen.getByText(/First page text/);
    selectFirstCharacters(source, 5);

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
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

  it("exposes a drag handle, delete affordance, language switcher, AI Assistant, and Translate for every Module (ANA-75/ANA-77)", () => {
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
    expect(
      screen.getByRole("button", { name: "Translate to English" }),
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

  describe("Delete", () => {
    it("removes a temporary Module locally after confirming, with no request", () => {
      const onModulesChange = vi.fn();
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
        { id: "module-2", material: { ar: "Second", en: "" } },
      ];
      renderView({ modules, onModulesChange });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      expect(onModulesChange).toHaveBeenCalledWith([modules[1]]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("uses the temporary-Module confirmation copy", () => {
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
      ];
      renderView({ modules });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

      expect(
        screen.getByText(
          "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.",
        ),
      ).toBeInTheDocument();
    });

    it("cancels without removing the Module", () => {
      const onModulesChange = vi.fn();
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
      ];
      renderView({ modules, onModulesChange });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onModulesChange).not.toHaveBeenCalled();
    });

    it("disables Delete for a Module already persisted during a partial Finish attempt, so it can't be locally orphaned", () => {
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
        { id: "module-2", material: { ar: "Second", en: "" } },
      ];
      renderView({
        modules,
        backDisabled: true,
        createdModuleIds: new Set(["module-1"]),
      });

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Delete Module 2" }),
      ).toBeEnabled();
    });

    it("disables every Delete action while Finish is in flight", () => {
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
      ];
      renderView({ modules, isFinishing: true });

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
    });
  });

  describe("Translate", () => {
    it("translates a Module's Arabic draft and applies the result to material.en only", async () => {
      translateArabicToEnglishMock.mockResolvedValueOnce("Translated text");
      const onModulesChange = vi.fn();
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
        { id: "module-2", material: { ar: "Second", en: "" } },
      ];
      renderView({ modules, onModulesChange });

      fireEvent.click(
        screen.getAllByRole("button", { name: "Translate to English" })[0],
      );

      await vi.waitFor(() =>
        expect(translateArabicToEnglishMock).toHaveBeenCalledWith("First"),
      );
      expect(applyLastModulesUpdate(onModulesChange, modules)).toEqual([
        { id: "module-1", material: { ar: "First", en: "Translated text" } },
        modules[1],
      ]);
    });

    it("applies its result against the latest modules when it resolves, preserving a concurrent edit made to a different card while it was in flight (PR review, blocking)", async () => {
      let resolveTranslate: (value: string) => void = () => {};
      translateArabicToEnglishMock.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveTranslate = resolve;
          }),
      );
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "Arabic one", en: "" } },
        { id: "module-2", material: { ar: "Arabic two", en: "" } },
      ];
      renderStatefulView({ modules });

      // Start translating Module 1.
      fireEvent.click(
        screen.getAllByRole("button", { name: "Translate to English" })[0],
      );
      await vi.waitFor(() =>
        expect(translateArabicToEnglishMock).toHaveBeenCalledWith("Arabic one"),
      );

      // Module 1 itself is frozen while its own request is in flight...
      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      // ...but Module 2 stays fully interactive (PR review, blocking).
      expect(
        screen.getByRole("button", { name: "Delete Module 2" }),
      ).toBeEnabled();

      // While that request is still pending, edit Module 2's own Learning
      // Material -- a real state update the builder must not lose.
      const editors = await screen.findAllByRole("textbox");
      const user = userEvent.setup();
      await user.click(editors[1]);
      await user.type(editors[1], "!");
      expect(await screen.findByText("Arabic two!")).toBeInTheDocument();

      // Now let Module 1's translation resolve.
      resolveTranslate("Translated one");

      // Module 1's active language tab stays exactly as it was (Arabic,
      // ANA-83) -- it is not switched to English on success.
      await vi.waitFor(() =>
        expect(
          screen.getAllByRole("button", { name: "Translate to English" })[0],
        ).toBeEnabled(),
      );
      expect(screen.getAllByRole("radio", { name: "Arabic" })[0]).toBeChecked();
      // The translation still landed in Module 1's English draft -- switch
      // to it manually to confirm.
      fireEvent.click(screen.getAllByRole("radio", { name: "English" })[0]);
      expect(await screen.findByText("Translated one")).toBeInTheDocument();
      // ...and Module 2's concurrent edit is still there, not reverted by
      // the translation applying against a stale snapshot of `modules`.
      expect(screen.getByText("Arabic two!")).toBeInTheDocument();
    });

    it("replaces non-empty English content immediately, without a confirmation modal (ANA-102)", async () => {
      translateArabicToEnglishMock.mockResolvedValueOnce("New translation");
      const onModulesChange = vi.fn();
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "Existing" } },
      ];
      renderView({ modules, onModulesChange });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      await vi.waitFor(() =>
        expect(translateArabicToEnglishMock).toHaveBeenCalledWith("First"),
      );
      expect(
        screen.queryByRole("dialog", { name: "Replace English translation?" }),
      ).not.toBeInTheDocument();
      expect(applyLastModulesUpdate(onModulesChange, modules)).toEqual([
        { id: "module-1", material: { ar: "First", en: "New translation" } },
      ]);
    });
  });

  describe("AI Assistant", () => {
    it("sends only the selected Markdown and bookId, and applies the result to only the selected range (ANA-85, PR review)", async () => {
      assistLearningMaterialMock.mockResolvedValueOnce("Refined text");
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
        { id: "module-2", material: { ar: "Second", en: "" } },
      ];
      renderStatefulView({ bookId: "book-42", modules });

      const editors = await screen.findAllByRole("textbox");
      selectFirstCharacters(editors[0], 5);
      await vi.waitFor(() =>
        expect(
          screen.getAllByRole("button", { name: "AI Assistant" })[0],
        ).toBeEnabled(),
      );
      fireEvent.click(
        screen.getAllByRole("button", { name: "AI Assistant" })[0],
      );
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      await vi.waitFor(() =>
        expect(assistLearningMaterialMock).toHaveBeenCalledWith({
          bookId: "book-42",
          text: "First",
          additionalInstructions: undefined,
        }),
      );
      expect(await screen.findByText("Refined text")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });

    it("applies its result against the latest modules when it resolves, preserving a concurrent edit made to a different card while it was in flight", async () => {
      let resolveAssist: (value: string) => void = () => {};
      assistLearningMaterialMock.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveAssist = resolve;
          }),
      );
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "Arabic one", en: "" } },
        { id: "module-2", material: { ar: "Arabic two", en: "" } },
      ];
      renderStatefulView({ modules });

      const editors = await screen.findAllByRole("textbox");
      selectFirstCharacters(editors[0], 10);
      await vi.waitFor(() =>
        expect(
          screen.getAllByRole("button", { name: "AI Assistant" })[0],
        ).toBeEnabled(),
      );
      fireEvent.click(
        screen.getAllByRole("button", { name: "AI Assistant" })[0],
      );
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
      await vi.waitFor(() =>
        expect(assistLearningMaterialMock).toHaveBeenCalledTimes(1),
      );

      // Module 1 itself is frozen while its own request is in flight...
      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      // ...but Module 2 stays fully interactive.
      expect(
        screen.getByRole("button", { name: "Delete Module 2" }),
      ).toBeEnabled();

      // While that request is still pending, edit Module 2's own Learning
      // Material -- a real state update the builder must not lose.
      const user = userEvent.setup();
      await user.click(editors[1]);
      await user.type(editors[1], "!");
      expect(await screen.findByText("Arabic two!")).toBeInTheDocument();

      resolveAssist("Refined one");

      // Module 1 unfreezes once the request resolves -- AI Assistant
      // itself goes back to *disabled* rather than enabled, since applying
      // the result clears the selection it was operating on (ANA-85, PR
      // review); Delete unfreezing is what signals the card is no longer
      // frozen.
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Delete Module 1" }),
        ).not.toBeDisabled(),
      );
      // Module 1's active language tab stays exactly as it was (Arabic).
      expect(screen.getAllByRole("radio", { name: "Arabic" })[0]).toBeChecked();
      expect(await screen.findByText("Refined one")).toBeInTheDocument();
      // ...and Module 2's concurrent edit is still there, not reverted by
      // the AI result applying against a stale snapshot of `modules`.
      expect(screen.getByText("Arabic two!")).toBeInTheDocument();
    });

    it("restores the original selected text and shows an error when the request fails", async () => {
      assistLearningMaterialMock.mockRejectedValueOnce(
        new Error("AI Assistant failed. Please try again."),
      );
      const modules: TempModule[] = [
        { id: "module-1", material: { ar: "First", en: "" } },
      ];
      renderStatefulView({ modules });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 5);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(
        await screen.findByText("AI Assistant failed. Please try again."),
      ).toBeInTheDocument();
      expect(screen.getByText("First")).toBeInTheDocument();
    });
  });
});
