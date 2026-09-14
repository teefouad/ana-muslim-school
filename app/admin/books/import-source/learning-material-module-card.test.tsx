import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import { LearningMaterialModuleCard } from "./learning-material-module-card";

// Selects the first `length` characters of the editor's first text node
// directly through the native Selection API -- jsdom doesn't support real
// cursor movement inside a contenteditable via simulated keyboard input
// (same technique as components/ui/markdown-editor.test.tsx).
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

function renderCard(
  overrides: Partial<
    React.ComponentProps<typeof LearningMaterialModuleCard>
  > = {},
) {
  const props: React.ComponentProps<typeof LearningMaterialModuleCard> = {
    testId: "module-card-0",
    index: 0,
    material: { ar: "", en: "" },
    onMaterialChange: vi.fn(),
    fontScale: 100,
    // Every real caller wires both of these (ANA-77) -- tests that need to
    // verify the omitted-prop behavior itself pass `onDelete: undefined` /
    // `onTranslate: undefined` explicitly (see "hides Delete/Translate
    // when their handlers are omitted" below).
    onDelete: vi.fn(),
    onTranslate: vi.fn(),
    ...overrides,
  };

  render(
    <MantineProvider>
      <LearningMaterialModuleCard {...props} />
    </MantineProvider>,
  );

  return props;
}

// Like `renderCard`, but exposes `rerender` for tests that need to change a
// prop (e.g. `drag.isDragging`) on an already-mounted instance rather than
// mounting a fresh one -- a fresh mount would never observe the transition
// the collapse-on-drag-start behavior reacts to.
function renderCardWithRerender(
  overrides: Partial<
    React.ComponentProps<typeof LearningMaterialModuleCard>
  > = {},
) {
  const baseProps: React.ComponentProps<typeof LearningMaterialModuleCard> = {
    testId: "module-card-0",
    index: 0,
    material: { ar: "", en: "" },
    onMaterialChange: vi.fn(),
    fontScale: 100,
    onDelete: vi.fn(),
    onTranslate: vi.fn(),
  };

  const result = render(
    <MantineProvider>
      <LearningMaterialModuleCard {...baseProps} {...overrides} />
    </MantineProvider>,
  );

  return {
    rerender: (
      nextOverrides: Partial<
        React.ComponentProps<typeof LearningMaterialModuleCard>
      >,
    ) =>
      result.rerender(
        <MantineProvider>
          <LearningMaterialModuleCard
            {...baseProps}
            {...overrides}
            {...nextOverrides}
          />
        </MantineProvider>,
      ),
  };
}

// AI Assistant applies its result by restoring its own captured Lexical
// selection directly in the mounted editor (ANA-85, PR review), which
// fires the editor's real `onChange` -- so tests exercising a successful
// (or failed) generation need a genuinely stateful `material`, not a bare
// `vi.fn()` that never feeds an update back into the rendered editor. An
// `onMaterialChange` passed in `overrides` is still invoked (for
// assertions), wrapped around the real setter so both happen together.
function renderStatefulCard(
  overrides: Partial<
    React.ComponentProps<typeof LearningMaterialModuleCard>
  > = {},
) {
  function Wrapper() {
    const [material, setMaterial] = useState<TranslatableString>(
      overrides.material ?? { ar: "", en: "" },
    );

    return (
      <LearningMaterialModuleCard
        testId="module-card-0"
        index={0}
        fontScale={100}
        onDelete={vi.fn()}
        onTranslate={vi.fn()}
        {...overrides}
        material={material}
        onMaterialChange={(value) => {
          overrides.onMaterialChange?.(value);
          setMaterial(value);
        }}
      />
    );
  }

  render(
    <MantineProvider>
      <Wrapper />
    </MantineProvider>,
  );
}

describe("LearningMaterialModuleCard", () => {
  it("labels the card with its 1-based Module index", () => {
    renderCard({ index: 2 });

    expect(screen.getByText("Module 3")).toBeInTheDocument();
  });

  it("is expanded by default, showing the Markdown editor", async () => {
    renderCard();

    await screen.findByRole("toolbar");
  });

  it("collapses and re-expands when the title is clicked", async () => {
    renderCard();

    await screen.findByRole("toolbar");
    const title = screen.getByRole("button", { name: "Module 1" });

    fireEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    fireEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("exposes a drag handle, AI Assistant/Translate/Delete actions, a language switcher, and the Markdown editor, with the language switcher right-most (ANA-88)", async () => {
    renderCard();

    const aiButton = screen.getByRole("button", { name: "AI Assistant" });
    const translateButton = screen.getByRole("button", {
      name: "Translate to English",
    });
    const deleteButton = screen.getByRole("button", {
      name: "Delete Module 1",
    });
    const languageSwitcher = screen.getByRole("radio", { name: "Arabic" });

    expect(aiButton).toBeInTheDocument();
    expect(translateButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(languageSwitcher).toBeInTheDocument();

    // Left-to-right DOM order matches the header spec (ANA-88): AI
    // Assistant, Translate, Delete, then the language switcher last.
    const header = deleteButton.closest("div");
    const controls = Array.from(header?.children ?? []);
    expect(controls.indexOf(aiButton)).toBeLessThan(
      controls.indexOf(translateButton),
    );
    expect(controls.indexOf(translateButton)).toBeLessThan(
      controls.indexOf(deleteButton),
    );
    expect(controls.indexOf(deleteButton)).toBeLessThan(controls.length - 1);

    await screen.findByRole("toolbar");
  });

  it("defaults to showing the Arabic Learning Material draft", async () => {
    renderCard({ material: { ar: "محتوى عربي", en: "English content" } });

    await screen.findByText("محتوى عربي");
    expect(screen.queryByText("English content")).not.toBeInTheDocument();
  });

  it("switching languages preserves independent Arabic/English drafts (ANA-75)", async () => {
    renderCard({ material: { ar: "محتوى عربي", en: "English content" } });

    await screen.findByText("محتوى عربي");
    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(await screen.findByText("English content")).toBeInTheDocument();
    expect(screen.queryByText("محتوى عربي")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Arabic" }));

    expect(await screen.findByText("محتوى عربي")).toBeInTheDocument();
    expect(screen.queryByText("English content")).not.toBeInTheDocument();
  });

  it("reports an edit to the active language only, leaving the other untouched", async () => {
    const onMaterialChange = vi.fn();
    renderCard({
      material: { ar: "Existing Arabic", en: "Existing English" },
      onMaterialChange,
    });

    const editable = await screen.findByRole("textbox");
    const user = userEvent.setup();
    await user.click(editable);
    await user.type(editable, "!");

    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ar: "Existing Arabic!",
      en: "Existing English",
    });
  });

  it("uses RTL for Arabic and LTR for English, following the active language (not a global source direction)", async () => {
    renderCard({ material: { ar: "Arabic", en: "English" } });

    let editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "rtl");

    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    editable = await screen.findByRole("textbox");
    expect(editable.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });

  it("scales the editor's font size", () => {
    renderCard({ fontScale: 150 });

    const editorScale = screen.getByTestId("module-card-0-editor-scale");
    expect(editorScale).toHaveStyle({ fontSize: "21px" });
  });

  it("makes the editor read-only when disabled", async () => {
    renderCard({ material: { ar: "Existing notes", en: "" }, disabled: true });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "false");
  });

  it("leaves the editor editable by default", async () => {
    renderCard({ material: { ar: "Existing notes", en: "" } });

    const editable = await screen.findByRole("textbox");
    expect(editable).toHaveAttribute("contenteditable", "true");
  });

  it("renders AI Assistant, Translate, and Delete visible at all times, not only on header hover/focus-within (ANA-88)", () => {
    renderCard();

    const deleteButton = screen.getByRole("button", {
      name: "Delete Module 1",
    });
    const aiButton = screen.getByRole("button", { name: "AI Assistant" });
    const translateButton = screen.getByRole("button", {
      name: "Translate to English",
    });

    expect(deleteButton.className).toMatch(/actionButton/);
    expect(aiButton.className).toMatch(/actionButton/);
    expect(translateButton.className).toMatch(/actionButton/);

    // None of them are hidden at rest -- there's no opacity-toggling
    // hover/focus-within affordance to hide behind anymore (ANA-88).
    expect(deleteButton).toBeVisible();
    expect(aiButton).toBeVisible();
    expect(translateButton).toBeVisible();
  });

  it("clicking delete or AI Assistant does not toggle the card's collapsed state", async () => {
    renderCard({ material: { ar: "Arabic content", en: "" } });
    await screen.findByRole("toolbar");

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("hides Delete/Translate when their handlers are omitted, instead of rendering a no-op button (PR review, Copilot) -- AI Assistant is unaffected, since it's never conditioned on a handler prop", () => {
    renderCard({ onDelete: undefined, onTranslate: undefined });

    expect(
      screen.queryByRole("button", { name: "Delete Module 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Translate to English" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "AI Assistant" }),
    ).toBeInTheDocument();
  });

  describe("Delete", () => {
    it("shows a confirmation dialog instead of deleting immediately", () => {
      const onDelete = vi.fn();
      renderCard({ onDelete });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

      expect(
        screen.getByRole("dialog", { name: "Delete module?" }),
      ).toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("uses the caller-provided confirmation description", () => {
      renderCard({
        onDelete: vi.fn(),
        deleteConfirmDescription:
          "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.",
      });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

      expect(
        screen.getByText(
          "This removes this unsaved Module and its Learning Material draft. This action cannot be undone.",
        ),
      ).toBeInTheDocument();
    });

    it("calls onDelete only after confirming", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      renderCard({ onDelete });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    });

    it("makes no call and closes the dialog when canceled", () => {
      const onDelete = vi.fn();
      renderCard({ onDelete });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Delete module?" }),
      ).not.toBeInTheDocument();
    });

    it("disables the delete action when deleteDisabled is set, independent of `disabled`", () => {
      renderCard({ onDelete: vi.fn(), deleteDisabled: true });

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
    });

    it("still closes the dialog and unblocks Cancel/Escape when onDelete rejects, without an unhandled rejection (PR review, Copilot)", async () => {
      const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
      renderCard({ onDelete });

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Delete module?" }),
        ).not.toBeInTheDocument(),
      );
      // The dialog is gone and the delete affordance is clickable again --
      // proof `isDeleting` didn't get stuck true.
      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      expect(
        screen.getByRole("dialog", { name: "Delete module?" }),
      ).toBeInTheDocument();
    });
  });

  describe("Translate", () => {
    it("is disabled when the Arabic draft is empty", () => {
      renderCard({ material: { ar: "", en: "" }, onTranslate: vi.fn() });

      expect(
        screen.getByRole("button", { name: "Translate to English" }),
      ).toBeDisabled();
    });

    it("translates immediately when English is empty, without touching either draft itself, and leaves the active language tab unchanged (ANA-83)", async () => {
      const onMaterialChange = vi.fn();
      const onTranslate = vi.fn().mockResolvedValue(undefined);
      renderCard({
        material: { ar: "Arabic content", en: "" },
        onMaterialChange,
        onTranslate,
      });

      // Arabic is the card's default active language -- confirm it's still
      // selected going in, so the assertion below actually proves nothing
      // switched it.
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      await vi.waitFor(() => expect(onTranslate).toHaveBeenCalledTimes(1));
      // The card never mutates `material` itself -- applying the returned
      // translation to `material.en` is entirely the caller's own
      // `onTranslate` implementation (ANA-77).
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Replace English translation?" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
    });

    it("leaves English selected after a successful translation, when English was the active tab (ANA-83)", async () => {
      const onTranslate = vi.fn().mockResolvedValue(undefined);
      renderCard({
        material: { ar: "Arabic content", en: "" },
        onTranslate,
      });

      fireEvent.click(screen.getByRole("radio", { name: "English" }));
      expect(screen.getByRole("radio", { name: "English" })).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      await vi.waitFor(() => expect(onTranslate).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    });

    it("shows the translated content immediately when it lands on the already-active language, without needing a tab switch first (regression: MDXEditor's `markdown` prop only seeds initial content -- an external update to the *active* language must be pushed in via setMarkdown, not rely on a remount that only happens on a language switch)", async () => {
      const onTranslate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderCardWithRerender({
        material: { ar: "Arabic content", en: "" },
        onTranslate,
      });

      fireEvent.click(screen.getByRole("radio", { name: "English" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );
      await vi.waitFor(() => expect(onTranslate).toHaveBeenCalledTimes(1));

      // Simulates the caller applying the translated result to `material.en`
      // once its own `onTranslate` implementation resolves (see
      // module-builder-view.tsx's `handleTranslateModule`) -- the active
      // language tab (English) never changes across this update.
      rerender({ material: { ar: "Arabic content", en: "Translated text" } });

      expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
      expect(await screen.findByText("Translated text")).toBeInTheDocument();
    });

    it("translates immediately when replacing non-empty English content, without a confirmation modal (ANA-102)", async () => {
      const onTranslate = vi.fn().mockResolvedValue(undefined);
      renderCard({
        material: { ar: "Arabic content", en: "Existing English" },
        onTranslate,
      });

      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      await vi.waitFor(() => expect(onTranslate).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByRole("dialog", { name: "Replace English translation?" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
    });

    it("keeps both drafts and shows an error when translation fails", async () => {
      const onMaterialChange = vi.fn();
      const onTranslate = vi
        .fn()
        .mockRejectedValue(new Error("Translation failed. Please try again."));
      renderCard({
        material: { ar: "Arabic content", en: "" },
        onMaterialChange,
        onTranslate,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      expect(
        await screen.findByText("Translation failed. Please try again."),
      ).toBeInTheDocument();
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(screen.getByText("Arabic content")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
    });

    it("disables translate while a request is already in flight", async () => {
      let resolveTranslate: () => void = () => {};
      const onTranslate = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveTranslate = resolve;
          }),
      );
      renderCard({
        material: { ar: "Arabic content", en: "" },
        onTranslate,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      expect(
        screen.getByRole("button", { name: "Translate to English" }),
      ).toBeDisabled();

      resolveTranslate();
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Translate to English" }),
        ).not.toBeDisabled(),
      );
    });

    it("freezes the editor, language switcher, Delete, AI Assistant, and drag handle while its own translation is in flight, then unfreezes on completion (PR review, blocking)", async () => {
      let resolveTranslate: () => void = () => {};
      const onTranslate = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveTranslate = resolve;
          }),
      );
      const attributes = { "aria-roledescription": "sortable" } as never;
      const listeners = { onPointerDown: vi.fn() } as never;
      renderCard({
        material: { ar: "Arabic content", en: "" },
        onTranslate,
        onDelete: vi.fn(),
        drag: {
          attributes,
          listeners,
          setNodeRef: vi.fn(),
          style: {},
          isDragging: false,
        },
      });

      const editable = await screen.findByRole("textbox");
      expect(editable).toHaveAttribute("contenteditable", "true");

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      expect(editable).toHaveAttribute("contenteditable", "false");
      expect(
        screen
          .getByRole("radio", { name: "Arabic" })
          .closest("[data-disabled]"),
      ).toHaveAttribute("data-disabled", "true");
      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "AI Assistant" }),
      ).toBeDisabled();
      const grip = document.querySelector(".lucide-grip-vertical")
        ?.parentElement as HTMLElement;
      expect(grip).toHaveAttribute("aria-hidden", "true");
      expect(grip).not.toHaveAttribute("aria-roledescription");

      resolveTranslate();

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Delete Module 1" }),
        ).not.toBeDisabled(),
      );
      // AI Assistant stays disabled here -- it now requires an active
      // selection (ANA-85, PR review), and none was made in this test; its
      // own freeze/unfreeze coverage lives in the "AI Assistant" describe
      // block below.
      expect(
        screen
          .getByRole("radio", { name: "Arabic" })
          .closest("[data-disabled]"),
      ).toHaveAttribute("data-disabled", "false");
      expect(grip).toHaveAttribute("aria-roledescription", "sortable");
      expect(grip).not.toHaveAttribute("aria-hidden");
    });
  });

  describe("AI Assistant", () => {
    it("is disabled when the active editor has no selection, even with non-empty content", async () => {
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist: vi.fn(),
      });
      await screen.findByRole("textbox");

      expect(
        screen.getByRole("button", { name: "AI Assistant" }),
      ).toBeDisabled();
    });

    it("becomes enabled once a non-empty selection is made in the active editor", async () => {
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist: vi.fn(),
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
    });

    it("opens the dialog with an empty instructions field once a selection is made, without calling onAiAssist or touching material yet", async () => {
      const onAiAssist = vi.fn();
      const onMaterialChange = vi.fn();
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
        onMaterialChange,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );

      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

      expect(
        screen.getByRole("dialog", { name: "AI Assistant" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", {
          name: "Additional instructions or context (optional)",
        }),
      ).toHaveValue("");
      expect(onAiAssist).not.toHaveBeenCalled();
      // Capturing the selection never mutates `material` or the editor's
      // own content (PR review) -- the document still reads exactly as it
      // did before the dialog opened.
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(screen.getByText("Arabic content")).toBeInTheDocument();
    });

    it("Cancel closes the dialog without calling onAiAssist -- nothing was ever mutated, so there is nothing to restore (PR review)", async () => {
      const onAiAssist = vi.fn();
      const onMaterialChange = vi.fn();
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
        onMaterialChange,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );

      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        screen.queryByRole("dialog", { name: "AI Assistant" }),
      ).not.toBeInTheDocument();
      expect(onAiAssist).not.toHaveBeenCalled();
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(screen.getByText("Arabic content")).toBeInTheDocument();
    });

    it("does not carry a previous session's instructions into a freshly reopened dialog", async () => {
      const onAiAssist = vi.fn().mockResolvedValue("Refined text");
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );

      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.change(
        screen.getByRole("textbox", {
          name: "Additional instructions or context (optional)",
        }),
        { target: { value: "Use more headings" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

      expect(
        screen.getByRole("textbox", {
          name: "Additional instructions or context (optional)",
        }),
      ).toHaveValue("");
    });

    it("Generate closes the dialog, shows loading, and calls onAiAssist with the active language, trimmed instructions, and the exact selected Markdown", async () => {
      let resolveAiAssist: (value: string) => void = () => {};
      const onAiAssist = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveAiAssist = resolve;
          }),
      );
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );

      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.change(
        screen.getByRole("textbox", {
          name: "Additional instructions or context (optional)",
        }),
        { target: { value: "  Use more headings  " } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(
        screen.queryByRole("dialog", { name: "AI Assistant" }),
      ).not.toBeInTheDocument();
      expect(onAiAssist).toHaveBeenCalledWith(
        "ar",
        "Use more headings",
        "Arabic",
      );
      expect(
        screen.getByRole("button", { name: "AI Assistant" }),
      ).toBeDisabled();

      resolveAiAssist("Refined text");
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).not.toBeDisabled(),
      );
    });

    it("passes undefined instructions when the field is left blank/whitespace-only", async () => {
      const onAiAssist = vi.fn().mockResolvedValue("Refined text");
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(onAiAssist).toHaveBeenCalledTimes(1));
      expect(onAiAssist.mock.calls[0][1]).toBeUndefined();
    });

    it("uses the active English tab, not Arabic, when English is selected", async () => {
      const onAiAssist = vi.fn().mockResolvedValue("Refined text");
      renderStatefulCard({
        material: { ar: "Arabic content", en: "English content" },
        onAiAssist,
      });

      fireEvent.click(screen.getByRole("radio", { name: "English" }));
      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 7);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(onAiAssist).toHaveBeenCalledTimes(1));
      expect(onAiAssist.mock.calls[0][0]).toBe("en");
      expect(onAiAssist.mock.calls[0][2]).toBe("English");
    });

    it("applies the result to only the selected range, leaving an identical duplicate elsewhere in the Module untouched (PR review)", async () => {
      const onAiAssist = vi.fn().mockResolvedValue("Hi");
      renderStatefulCard({
        material: { ar: "Hello world. Hello again.", en: "" },
        onAiAssist,
      });

      const editable = await screen.findByRole("textbox");
      // Selects only the *first* "Hello" -- the identical "Hello" later in
      // "Hello again." must survive untouched.
      selectFirstCharacters(editable, 5);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(
        await screen.findByText("Hi world. Hello again."),
      ).toBeInTheDocument();
    });

    it("leaves material completely unchanged and shows an error when generation fails -- nothing was ever mutated, so there is nothing to restore (PR review)", async () => {
      const onMaterialChange = vi.fn();
      const onAiAssist = vi
        .fn()
        .mockRejectedValue(new Error("AI Assistant failed. Please try again."));
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onMaterialChange,
        onAiAssist,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
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
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(screen.getByText("Arabic content")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();
    });

    it("freezes the editor, language switcher, Delete, Translate, and drag handle while generating, then unfreezes on completion", async () => {
      let resolveAiAssist: (value: string) => void = () => {};
      const onAiAssist = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveAiAssist = resolve;
          }),
      );
      const attributes = { "aria-roledescription": "sortable" } as never;
      const listeners = { onPointerDown: vi.fn() } as never;
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onAiAssist,
        onDelete: vi.fn(),
        onTranslate: vi.fn(),
        drag: {
          attributes,
          listeners,
          setNodeRef: vi.fn(),
          style: {},
          isDragging: false,
        },
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(editable).toHaveAttribute("contenteditable", "false");
      expect(
        screen
          .getByRole("radio", { name: "Arabic" })
          .closest("[data-disabled]"),
      ).toHaveAttribute("data-disabled", "true");
      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Translate to English" }),
      ).toBeDisabled();
      const grip = document.querySelector(".lucide-grip-vertical")
        ?.parentElement as HTMLElement;
      expect(grip).toHaveAttribute("aria-hidden", "true");

      resolveAiAssist("Refined text");

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Delete Module 1" }),
        ).not.toBeDisabled(),
      );
      expect(
        screen.getByRole("button", { name: "Translate to English" }),
      ).not.toBeDisabled();
      expect(grip).toHaveAttribute("aria-roledescription", "sortable");
    });

    it("does nothing when onAiAssist is omitted -- Generate just closes the dialog, leaving material unchanged", async () => {
      const onMaterialChange = vi.fn();
      renderStatefulCard({
        material: { ar: "Arabic content", en: "" },
        onMaterialChange,
      });

      const editable = await screen.findByRole("textbox");
      selectFirstCharacters(editable, 6);
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "AI Assistant" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));

      expect(
        screen.queryByRole("dialog", { name: "AI Assistant" }),
      ).not.toBeInTheDocument();
      expect(onMaterialChange).not.toHaveBeenCalled();
      expect(screen.getByText("Arabic content")).toBeInTheDocument();
    });
  });

  function gripElement(container: HTMLElement) {
    return container.querySelector(".lucide-grip-vertical")
      ?.parentElement as HTMLElement;
  }

  it("renders a decorative, non-interactive grip when not draggable (saved-Source workspace usage)", () => {
    const { container } = render(
      <MantineProvider>
        <LearningMaterialModuleCard
          testId="module-card-0"
          index={0}
          material={{ ar: "", en: "" }}
          onMaterialChange={vi.fn()}
          fontScale={100}
        />
      </MantineProvider>,
    );

    // No dnd-kit attributes/listeners are applied when `drag` is omitted --
    // the grip icon chrome is still present for visual consistency with
    // the Create-from-PDF card, but it isn't a real drag handle (ANA-75).
    const grip = gripElement(container);
    expect(grip).toHaveAttribute("aria-hidden", "true");
    // Not a grab cursor either -- a decorative grip must not imply an
    // interaction (reordering) that isn't actually available here (PR
    // review).
    expect(grip.className).not.toMatch(/gripDraggable/);
  });

  it("wires the grip as the real drag handle when `drag` is provided", () => {
    const attributes = { "aria-roledescription": "sortable" } as never;
    const listeners = { onPointerDown: vi.fn() } as never;
    const { container } = render(
      <MantineProvider>
        <LearningMaterialModuleCard
          testId="module-card-0"
          index={0}
          material={{ ar: "", en: "" }}
          onMaterialChange={vi.fn()}
          fontScale={100}
          drag={{
            attributes,
            listeners,
            setNodeRef: vi.fn(),
            style: {},
            isDragging: false,
          }}
        />
      </MantineProvider>,
    );

    const grip = gripElement(container);
    expect(grip).toHaveAttribute("aria-roledescription", "sortable");
    expect(grip).not.toHaveAttribute("aria-hidden");
    expect(grip.className).toMatch(/gripDraggable/);
  });

  describe("collapses on drag start (ANA-80)", () => {
    function dragProp(isDragging: boolean) {
      return {
        attributes: {} as never,
        listeners: {} as never,
        setNodeRef: vi.fn(),
        style: {},
        isDragging,
      };
    }

    it("collapses automatically once a drag starts, even if it was expanded", async () => {
      const { rerender } = renderCardWithRerender({ drag: dragProp(false) });
      await screen.findByRole("toolbar");

      rerender({ drag: dragProp(true) });

      expect(screen.getByRole("button", { name: "Module 1" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("stays collapsed after the drag ends (drop or cancel), instead of re-expanding on its own", async () => {
      const { rerender } = renderCardWithRerender({ drag: dragProp(false) });
      await screen.findByRole("toolbar");

      rerender({ drag: dragProp(true) });
      rerender({ drag: dragProp(false) });

      expect(screen.getByRole("button", { name: "Module 1" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("leaves an already-collapsed card collapsed once a drag starts", () => {
      const { rerender } = renderCardWithRerender({ drag: dragProp(false) });

      fireEvent.click(screen.getByRole("button", { name: "Module 1" }));
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

      rerender({ drag: dragProp(true) });

      expect(screen.getByRole("button", { name: "Module 1" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  describe("forceCollapsed drag-overlay preview (ANA-80)", () => {
    it("renders collapsed regardless of a fresh instance's own default state, and never shows the Markdown editor", () => {
      renderCard({ forceCollapsed: true });

      expect(screen.getByRole("button", { name: "Module 1" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("ignores clicks on the title -- the preview is never interactive", () => {
      renderCard({ forceCollapsed: true });

      const title = screen.getByRole("button", { name: "Module 1" });
      expect(title).toBeDisabled();

      fireEvent.click(title);
      expect(title).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("still reserves Delete/AI Assistant/Translate and the language switcher in the header, matching the collapsed idle card's layout", () => {
      renderCard({ forceCollapsed: true });

      expect(
        screen.getByRole("button", { name: "Delete Module 1" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "AI Assistant" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Translate to English" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Arabic" })).toBeInTheDocument();
    });
  });
});
