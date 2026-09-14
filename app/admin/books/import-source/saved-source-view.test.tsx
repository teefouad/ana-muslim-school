import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceModuleEntry } from "./import-source-types";

const {
  deleteModuleMock,
  translateArabicToEnglishMock,
  assistLearningMaterialMock,
} = vi.hoisted(() => ({
  deleteModuleMock: vi.fn(),
  translateArabicToEnglishMock: vi.fn(),
  assistLearningMaterialMock: vi.fn(),
}));

vi.mock("./modules-client", () => ({
  deleteModule: deleteModuleMock,
}));

vi.mock("./translate-client", () => ({
  translateArabicToEnglish: translateArabicToEnglishMock,
}));

vi.mock("./ai-assist-client", () => ({
  assistLearningMaterial: assistLearningMaterialMock,
}));

const { SavedSourceView } = await import("./saved-source-view");

const SAMPLE_ENTRIES: WorkspaceModuleEntry[] = [
  {
    key: "module-1",
    moduleId: "module-1",
    material: { ar: "First material", en: "" },
  },
  { key: "module-2", moduleId: "module-2", material: { ar: "", en: "" } },
];

function renderView(
  overrides: Partial<React.ComponentProps<typeof SavedSourceView>> = {},
) {
  const props: React.ComponentProps<typeof SavedSourceView> = {
    bookId: "book-1",
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

// Selects the first `length` characters of a Module card's Markdown editor
// directly through the native Selection API (same technique as
// components/ui/markdown-editor.test.tsx and module-builder-view.test.tsx)
// -- needed for AI Assistant, which now requires an active selection
// (ANA-85, PR review). Distinct from `selectText` above, which drives the
// plain `<textarea>` Source Text panel instead.
function selectFirstCharacters(root: HTMLElement, length: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

// `onEntriesChange` now accepts either a plain array or a functional
// updater (see SavedSourceViewProps -- ANA-77, PR review) -- this resolves
// a mock's last call against a known "current" array either way, so
// assertions don't need to care which form the component under test used.
function applyLastEntriesUpdate(
  onEntriesChange: ReturnType<typeof vi.fn>,
  current: WorkspaceModuleEntry[],
): WorkspaceModuleEntry[] {
  const arg = onEntriesChange.mock.calls.at(-1)?.[0];
  return typeof arg === "function" ? arg(current) : arg;
}

// A stateful wrapper for scenarios that need `entries` to genuinely persist
// across renders -- e.g. verifying a concurrent edit to one card survives a
// *different* card's in-flight Translate/Delete request resolving later
// (PR review, blocking). `renderView`'s plain `vi.fn()` mock can't model
// this: it never feeds a result back into `entries`.
function renderStatefulView(
  overrides: Partial<React.ComponentProps<typeof SavedSourceView>> & {
    entries: WorkspaceModuleEntry[];
  },
) {
  function Wrapper() {
    const [entries, setEntries] = useState(overrides.entries);

    return (
      <SavedSourceView
        bookId="book-1"
        content="Saved source text"
        onContentChange={vi.fn()}
        onRemove={vi.fn()}
        isRemoving={false}
        removeError={null}
        onSave={vi.fn()}
        isSaving={false}
        saveError={null}
        fontScale={100}
        onFontScaleChange={vi.fn()}
        direction="rtl"
        onDirectionChange={vi.fn()}
        {...overrides}
        entries={entries}
        onEntriesChange={setEntries}
      />
    );
  }

  render(
    <MantineProvider>
      <Wrapper />
    </MantineProvider>,
  );
}

// The Source Text panel's plain <textarea> also has an implicit
// role="textbox", alongside each Module's contenteditable MarkdownEditor --
// this narrows a `findAllByRole("textbox")` result down to just the latter.
async function findMaterialEditors() {
  const textboxes = await screen.findAllByRole("textbox");
  return textboxes.filter((el) => el.tagName !== "TEXTAREA");
}

describe("SavedSourceView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("exposes a drag handle, delete affordance, language switcher, AI Assistant, and Translate for every Module (ANA-77/ANA-79)", () => {
    renderView({ entries: SAMPLE_ENTRIES });

    expect(
      screen.getByRole("button", { name: "Delete Module 1" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Arabic" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "English" })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "AI Assistant" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Translate to English" }),
    ).toHaveLength(2);
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
      {
        key: "module-1",
        moduleId: "module-1",
        material: { ar: "First material!", en: "" },
      },
      { key: "module-2", moduleId: "module-2", material: { ar: "", en: "" } },
    ]);
  });

  it("Create Module is disabled until non-whitespace Source Text is selected", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("enables Create Module once Source Text is selected, and seeds the new Module's Arabic Learning Material with the exact selection, leaving English empty", () => {
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
      {
        key: expect.any(String),
        moduleId: null,
        material: { ar: "Some", en: "" },
      },
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

  describe("Delete", () => {
    it("deletes a persisted Module through the API, then removes it from entries and revalidates caches", async () => {
      deleteModuleMock.mockResolvedValueOnce(undefined);
      const onEntriesChange = vi.fn();
      const onModuleDeleted = vi.fn();
      renderView({
        entries: SAMPLE_ENTRIES,
        onEntriesChange,
        onModuleDeleted,
      });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() =>
        expect(deleteModuleMock).toHaveBeenCalledWith("book-1", "module-1"),
      );
      expect(applyLastEntriesUpdate(onEntriesChange, SAMPLE_ENTRIES)).toEqual([
        SAMPLE_ENTRIES[1],
      ]);
      expect(onModuleDeleted).toHaveBeenCalledTimes(1);
    });

    it("removes an unsaved (moduleId: null) Module locally, with no API request", () => {
      const unsavedEntries: WorkspaceModuleEntry[] = [
        { key: "temp-1", moduleId: null, material: { ar: "Draft", en: "" } },
      ];
      const onEntriesChange = vi.fn();
      renderView({ entries: unsavedEntries, onEntriesChange });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      expect(applyLastEntriesUpdate(onEntriesChange, unsavedEntries)).toEqual(
        [],
      );
      expect(deleteModuleMock).not.toHaveBeenCalled();
    });

    it("uses the temporary-Module confirmation copy for an unsaved entry", () => {
      const unsavedEntries: WorkspaceModuleEntry[] = [
        { key: "temp-1", moduleId: null, material: { ar: "Draft", en: "" } },
      ];
      renderView({ entries: unsavedEntries });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

      expect(
        screen.getByText(
          "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.",
        ),
      ).toBeInTheDocument();
    });

    it("cancels without deleting or making a request", () => {
      const onEntriesChange = vi.fn();
      renderView({ entries: SAMPLE_ENTRIES, onEntriesChange });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onEntriesChange).not.toHaveBeenCalled();
      expect(deleteModuleMock).not.toHaveBeenCalled();
    });

    it("leaves the entry in place and shows an error when the delete request fails", async () => {
      deleteModuleMock.mockRejectedValueOnce(
        new Error("Module still has Lessons."),
      );
      const onEntriesChange = vi.fn();
      renderView({ entries: SAMPLE_ENTRIES, onEntriesChange });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      expect(
        await screen.findByText("Module still has Lessons."),
      ).toBeInTheDocument();
      expect(onEntriesChange).not.toHaveBeenCalled();
      expect(screen.getByText("Module 1")).toBeInTheDocument();
    });

    it("disables every card's delete action while Save Changes is in flight", () => {
      renderView({ entries: SAMPLE_ENTRIES, isSaving: true });

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
    });
  });

  describe("Reorder (ANA-79)", () => {
    // Same technique as source-modules-panel.test.tsx -- dnd-kit's keyboard
    // coordinate math needs real-ish rects, keyed by the shared panel's own
    // testid scheme.
    function stubItemRects(order: string[], itemHeight = 60) {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const container = this.closest('[data-testid^="module-card-"]');
          const id = container
            ?.getAttribute("data-testid")
            ?.replace("module-card-", "");
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

    // The spy above is created fresh per test, on the shared
    // `Element.prototype` -- restore it after each test so the mocked
    // geometry can't leak into unrelated tests in this file (Copilot
    // review).
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("reorders persisted Modules via keyboard drag and reports the full new order", async () => {
      stubItemRects(["module-1", "module-2"]);
      const onEntriesChange = vi.fn();
      renderView({ entries: SAMPLE_ENTRIES, onEntriesChange });

      const card = screen.getByTestId("module-card-module-1");
      const handle = card.querySelector('span[role="button"]') as HTMLElement;
      expect(handle).toBeTruthy();

      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      expect(onEntriesChange).toHaveBeenCalledWith([
        SAMPLE_ENTRIES[1],
        SAMPLE_ENTRIES[0],
      ]);
    });

    it("reorders a mix of persisted and temporary (unsaved) Modules relative to each other", async () => {
      const mixedEntries: WorkspaceModuleEntry[] = [
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "First", en: "" },
        },
        { key: "temp-1", moduleId: null, material: { ar: "Draft", en: "" } },
      ];
      stubItemRects(["module-1", "temp-1"]);
      const onEntriesChange = vi.fn();
      renderView({ entries: mixedEntries, onEntriesChange });

      const card = screen.getByTestId("module-card-module-1");
      const handle = card.querySelector('span[role="button"]') as HTMLElement;

      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      expect(onEntriesChange).toHaveBeenCalledWith([
        mixedEntries[1],
        mixedEntries[0],
      ]);
    });

    it("does not attach drag listeners while Save changes is in flight", () => {
      renderView({ entries: SAMPLE_ENTRIES, isSaving: true });

      const card = screen.getByTestId("module-card-module-1");
      expect(card.querySelector('span[role="button"]')).toBeNull();
    });
  });

  describe("Translate", () => {
    it("translates the active entry's Arabic draft and applies the result to material.en only", async () => {
      translateArabicToEnglishMock.mockResolvedValueOnce("Translated text");
      const onEntriesChange = vi.fn();
      renderView({ entries: SAMPLE_ENTRIES, onEntriesChange });

      fireEvent.click(
        screen.getAllByRole("button", { name: "Translate to English" })[0],
      );

      await vi.waitFor(() =>
        expect(translateArabicToEnglishMock).toHaveBeenCalledWith(
          "First material",
        ),
      );
      expect(applyLastEntriesUpdate(onEntriesChange, SAMPLE_ENTRIES)).toEqual([
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "First material", en: "Translated text" },
        },
        SAMPLE_ENTRIES[1],
      ]);
    });

    it("applies its result against the latest entries when it resolves, preserving a concurrent edit made to a different card while it was in flight (PR review, blocking)", async () => {
      let resolveTranslate: (value: string) => void = () => {};
      translateArabicToEnglishMock.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveTranslate = resolve;
          }),
      );
      const entries: WorkspaceModuleEntry[] = [
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "Arabic one", en: "" },
        },
        {
          key: "module-2",
          moduleId: "module-2",
          material: { ar: "Arabic two", en: "" },
        },
      ];
      renderStatefulView({ entries });

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
      // Material -- a real state update the workspace must not lose.
      const editors = await findMaterialEditors();
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
      // the translation applying against a stale snapshot of `entries`.
      expect(screen.getByText("Arabic two!")).toBeInTheDocument();
    });

    it("replaces non-empty English content immediately, without a confirmation modal (ANA-102)", async () => {
      translateArabicToEnglishMock.mockResolvedValueOnce("New translation");
      const entriesWithEnglish: WorkspaceModuleEntry[] = [
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "Arabic", en: "Existing English" },
        },
      ];
      const onEntriesChange = vi.fn();
      renderView({ entries: entriesWithEnglish, onEntriesChange });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      await vi.waitFor(() =>
        expect(translateArabicToEnglishMock).toHaveBeenCalledWith("Arabic"),
      );
      expect(
        screen.queryByRole("dialog", { name: "Replace English translation?" }),
      ).not.toBeInTheDocument();
      expect(
        applyLastEntriesUpdate(onEntriesChange, entriesWithEnglish),
      ).toEqual([
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "Arabic", en: "New translation" },
        },
      ]);
    });
  });

  describe("AI Assistant", () => {
    it("sends only the selected Markdown and bookId, and applies the result to only the selected range (ANA-85, PR review)", async () => {
      assistLearningMaterialMock.mockResolvedValueOnce("Refined text");
      renderStatefulView({ bookId: "book-42", entries: SAMPLE_ENTRIES });

      const editors = await findMaterialEditors();
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
      expect(
        await screen.findByText("Refined text material"),
      ).toBeInTheDocument();
    });

    it("applies its result against the latest entries when it resolves, preserving a concurrent edit made to a different card while it was in flight", async () => {
      let resolveAssist: (value: string) => void = () => {};
      assistLearningMaterialMock.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveAssist = resolve;
          }),
      );
      const entries: WorkspaceModuleEntry[] = [
        {
          key: "module-1",
          moduleId: "module-1",
          material: { ar: "Arabic one", en: "" },
        },
        {
          key: "module-2",
          moduleId: "module-2",
          material: { ar: "Arabic two", en: "" },
        },
      ];
      renderStatefulView({ entries });

      const editors = await findMaterialEditors();
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

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Delete Module 2" }),
      ).toBeEnabled();

      const user = userEvent.setup();
      await user.click(editors[1]);
      await user.type(editors[1], "!");
      expect(await screen.findByText("Arabic two!")).toBeInTheDocument();

      resolveAssist("Refined one");

      // AI Assistant itself goes back to *disabled* once resolved, since
      // applying the result clears the selection it was operating on
      // (ANA-85, PR review) -- Delete unfreezing is what signals the card
      // is no longer frozen.
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Delete Module 1" }),
        ).not.toBeDisabled(),
      );
      expect(screen.getAllByRole("radio", { name: "Arabic" })[0]).toBeChecked();
      expect(await screen.findByText("Refined one")).toBeInTheDocument();
      expect(screen.getByText("Arabic two!")).toBeInTheDocument();
    });

    it("restores the original selected text and shows an error when the request fails", async () => {
      assistLearningMaterialMock.mockRejectedValueOnce(
        new Error("AI Assistant failed. Please try again."),
      );
      renderStatefulView({ entries: SAMPLE_ENTRIES });

      const editors = await findMaterialEditors();
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

      expect(
        await screen.findByText("AI Assistant failed. Please try again."),
      ).toBeInTheDocument();
      expect(screen.getByText("First material")).toBeInTheDocument();
    });
  });
});
