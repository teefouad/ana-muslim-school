import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LearningMaterialModuleCard } from "./learning-material-module-card";

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

  it("exposes a drag handle, Delete/AI Assistant/Translate actions, a language switcher, and the Markdown editor, with the language switcher right-most (ANA-77)", async () => {
    renderCard();

    const deleteButton = screen.getByRole("button", {
      name: "Delete Module 1",
    });
    const aiButton = screen.getByRole("button", { name: "AI Assistant" });
    const translateButton = screen.getByRole("button", {
      name: "Translate to English",
    });
    const languageSwitcher = screen.getByRole("radio", { name: "Arabic" });

    expect(deleteButton).toBeInTheDocument();
    expect(aiButton).toBeInTheDocument();
    expect(translateButton).toBeInTheDocument();
    expect(languageSwitcher).toBeInTheDocument();

    // Left-to-right DOM order matches the header spec: Delete, AI
    // Assistant, Translate, then the language switcher last.
    const header = deleteButton.closest("div");
    const controls = Array.from(header?.children ?? []);
    expect(controls.indexOf(deleteButton)).toBeLessThan(
      controls.indexOf(aiButton),
    );
    expect(controls.indexOf(aiButton)).toBeLessThan(
      controls.indexOf(translateButton),
    );
    expect(controls.indexOf(translateButton)).toBeLessThan(controls.length - 1);

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

  it("renders Delete, AI Assistant, and Translate hidden at rest, revealed together on header hover/focus-within, while the language switcher stays visible (ANA-77)", () => {
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
  });

  it("clicking delete or AI Assistant does not toggle the card's collapsed state", async () => {
    renderCard();
    await screen.findByRole("toolbar");

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    expect(await screen.findByRole("toolbar")).toBeInTheDocument();
  });

  it("makes no network/AI request when AI Assistant is clicked (ANA-75)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("hides Delete/Translate when their handlers are omitted, instead of rendering a no-op button (PR review, Copilot)", () => {
    renderCard({ onDelete: undefined, onTranslate: undefined });

    expect(
      screen.queryByRole("button", { name: "Delete Module 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Translate to English" }),
    ).not.toBeInTheDocument();
    // AI Assistant is unaffected -- it's always inert regardless of props
    // (ANA-75).
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

    it("requires confirmation before replacing non-empty English content", () => {
      const onTranslate = vi.fn();
      renderCard({
        material: { ar: "Arabic content", en: "Existing English" },
        onTranslate,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Replace English translation?" }),
      ).toBeInTheDocument();
      expect(onTranslate).not.toHaveBeenCalled();
    });

    it("canceling the replacement leaves content untouched and makes no request", () => {
      const onTranslate = vi.fn();
      renderCard({
        material: { ar: "Arabic content", en: "Existing English" },
        onTranslate,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onTranslate).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Replace English translation?" }),
      ).not.toBeInTheDocument();
    });

    it("translates after confirming replacement of existing English content, without changing the active language tab (ANA-83)", async () => {
      const onTranslate = vi.fn().mockResolvedValue(undefined);
      renderCard({
        material: { ar: "Arabic content", en: "Existing English" },
        onTranslate,
      });

      expect(screen.getByRole("radio", { name: "Arabic" })).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", { name: "Translate to English" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Translate and replace" }),
      );

      await vi.waitFor(() => expect(onTranslate).toHaveBeenCalledTimes(1));
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
      expect(
        screen.getByRole("button", { name: "AI Assistant" }),
      ).not.toBeDisabled();
      expect(
        screen
          .getByRole("radio", { name: "Arabic" })
          .closest("[data-disabled]"),
      ).toHaveAttribute("data-disabled", "false");
      expect(grip).toHaveAttribute("aria-roledescription", "sortable");
      expect(grip).not.toHaveAttribute("aria-hidden");
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
