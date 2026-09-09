import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import { SourceModulesPanel } from "./source-modules-panel";

// Selects the first `length` characters of the editor's first text node
// directly through the native Selection API (same technique as
// components/ui/markdown-editor.test.tsx and learning-material-module-
// card.test.tsx) -- needed for AI Assistant, which now requires an active
// selection (ANA-85, PR review).
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

type Item = { key: string; material: TranslatableString };

const ITEMS: Item[] = [
  { key: "module-1", material: { ar: "أول", en: "" } },
  { key: "module-2", material: { ar: "ثاني", en: "" } },
];

// Same technique as sortable-list.test.tsx -- dnd-kit's keyboard coordinate
// math needs real-ish rects, keyed by this component's own testid scheme.
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

function renderPanel(
  overrides: Partial<
    React.ComponentProps<typeof SourceModulesPanel<Item>>
  > = {},
) {
  const props: React.ComponentProps<typeof SourceModulesPanel<Item>> = {
    items: ITEMS,
    getKey: (item) => item.key,
    getMaterial: (item) => item.material,
    onMaterialChange: vi.fn(),
    onReorder: vi.fn(),
    fontScale: 100,
    disabled: false,
    reorderDisabled: false,
    canCreateModule: false,
    onCreateModule: vi.fn(),
    onDeleteItem: vi.fn(),
    isDeleteDisabled: () => false,
    onTranslateItem: vi.fn(),
    onAiAssistItem: vi.fn(),
    ...overrides,
  };

  const { container } = render(
    <MantineProvider>
      <SourceModulesPanel<Item> {...props} />
    </MantineProvider>,
  );

  return { ...props, container };
}

// AI Assistant's selection-token flow (ANA-85, PR review) round-trips
// through the real `onMaterialChange` callback -- `renderPanel`'s bare
// `vi.fn()` never feeds an update back into `items`, so tests exercising
// that flow need a genuinely stateful wrapper instead.
function renderStatefulPanel(
  overrides: Partial<
    React.ComponentProps<typeof SourceModulesPanel<Item>>
  > = {},
) {
  function Wrapper() {
    const [items, setItems] = useState<Item[]>(overrides.items ?? ITEMS);

    return (
      <SourceModulesPanel<Item>
        getKey={(item) => item.key}
        getMaterial={(item) => item.material}
        onReorder={setItems}
        fontScale={100}
        disabled={false}
        reorderDisabled={false}
        canCreateModule={false}
        onCreateModule={vi.fn()}
        onDeleteItem={vi.fn()}
        isDeleteDisabled={() => false}
        onTranslateItem={vi.fn()}
        onAiAssistItem={vi.fn()}
        {...overrides}
        items={items}
        onMaterialChange={(key, material) =>
          setItems((current) =>
            current.map((item) =>
              item.key === key ? { ...item, material } : item,
            ),
          )
        }
      />
    );
  }

  render(
    <MantineProvider>
      <Wrapper />
    </MantineProvider>,
  );
}

describe("SourceModulesPanel", () => {
  // `stubItemRects` spies `Element.prototype.getBoundingClientRect` fresh
  // per test -- restore it after each so the mocked geometry can't leak
  // into unrelated tests in this file (Copilot review).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the Modules count and each item as the shared Module card", () => {
    renderPanel();

    expect(screen.getByText("Modules (2)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Module 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Module 2" }),
    ).toBeInTheDocument();
  });

  it("shows the empty-state copy and omits the count when there are no items", () => {
    renderPanel({ items: [] });

    expect(screen.getByText("Modules")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select text on the left and click “Create Module” to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("enables Create Module only when canCreateModule is true, and disables it while disabled", () => {
    const { rerender } = render(
      <MantineProvider>
        <SourceModulesPanel<Item>
          items={[]}
          getKey={(item) => item.key}
          getMaterial={(item) => item.material}
          onMaterialChange={vi.fn()}
          onReorder={vi.fn()}
          fontScale={100}
          disabled={false}
          reorderDisabled={false}
          canCreateModule={false}
          onCreateModule={vi.fn()}
          onDeleteItem={vi.fn()}
          isDeleteDisabled={() => false}
          onTranslateItem={vi.fn()}
          onAiAssistItem={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();

    rerender(
      <MantineProvider>
        <SourceModulesPanel<Item>
          items={[]}
          getKey={(item) => item.key}
          getMaterial={(item) => item.material}
          onMaterialChange={vi.fn()}
          onReorder={vi.fn()}
          fontScale={100}
          disabled={true}
          reorderDisabled={false}
          canCreateModule={true}
          onCreateModule={vi.fn()}
          onDeleteItem={vi.fn()}
          isDeleteDisabled={() => false}
          onTranslateItem={vi.fn()}
          onAiAssistItem={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Create Module" }),
    ).toBeDisabled();
  });

  it("calls onCreateModule when Create Module is clicked", () => {
    const onCreateModule = vi.fn();
    renderPanel({ canCreateModule: true, onCreateModule });

    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));

    expect(onCreateModule).toHaveBeenCalledTimes(1);
  });

  it("wires delete and translate per item, keyed by getKey", () => {
    const onDeleteItem = vi.fn();
    const onTranslateItem = vi.fn();
    renderPanel({ onDeleteItem, onTranslateItem });

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete module" }));
    expect(onDeleteItem).toHaveBeenCalledWith("module-1");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Translate to English" })[1],
    );
    expect(onTranslateItem).toHaveBeenCalledWith("module-2");
  });

  it("wires AI Assistant per item, keyed by getKey, forwarding the active language, instructions, and selected Markdown (ANA-85, PR review)", async () => {
    const onAiAssistItem = vi.fn().mockResolvedValue("Refined text");
    renderStatefulPanel({ onAiAssistItem });

    const editors = await screen.findAllByRole("textbox");
    selectFirstCharacters(editors[1], 4);
    await vi.waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "AI Assistant" })[1],
      ).toBeEnabled(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "AI Assistant" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await vi.waitFor(() => expect(onAiAssistItem).toHaveBeenCalledTimes(1));
    expect(onAiAssistItem).toHaveBeenCalledWith(
      "module-2",
      "ar",
      undefined,
      "ثاني",
    );
    expect(await screen.findByText("Refined text")).toBeInTheDocument();
  });

  it("disables an item's delete action per isDeleteDisabled(key)", () => {
    renderPanel({ isDeleteDisabled: (key) => key === "module-1" });

    expect(
      screen.getByRole("button", { name: "Delete Module 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete Module 2" }),
    ).toBeEnabled();
  });

  it("uses getDeleteConfirmDescription(key) for the confirmation copy", () => {
    renderPanel({
      getDeleteConfirmDescription: (key) => `Custom copy for ${key}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));

    expect(screen.getByText("Custom copy for module-1")).toBeInTheDocument();
  });

  it("reorders items via keyboard drag and calls onReorder with the full new order", async () => {
    stubItemRects(["module-1", "module-2"]);
    const onReorder = vi.fn();
    renderPanel({ onReorder });

    // The grip only carries dnd-kit's own listeners/attributes (including
    // an explicit role="button") once reordering is enabled.
    const card = screen.getByTestId("module-card-module-1");
    const handle = card.querySelector('span[role="button"]') as HTMLElement;
    expect(handle).toBeTruthy();

    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(handle, { code: "Space", key: " " });

    expect(onReorder).toHaveBeenCalledWith([ITEMS[1], ITEMS[0]]);
  });

  it("does not attach drag listeners when reorderDisabled is true", () => {
    renderPanel({ reorderDisabled: true });

    const card = screen.getByTestId("module-card-module-1");
    expect(card.querySelector('span[role="button"]')).toBeNull();
  });

  it("freezes every card's editor while disabled", async () => {
    renderPanel({ disabled: true });

    const editors = await screen.findAllByRole("textbox");
    expect(editors[0]).toHaveAttribute("contenteditable", "false");
  });

  describe("drag overlay collapse and fidelity (ANA-80)", () => {
    it("collapses an expanded card the instant its drag starts, and the overlay preview never shows its Markdown editor", async () => {
      stubItemRects(["module-1", "module-2"]);
      const { container } = renderPanel();

      // Module 1 starts expanded (the default) -- confirm the editor is
      // showing before dragging it.
      await screen.findAllByRole("toolbar");

      const handle = screen
        .getByTestId("module-card-module-1")
        .querySelector('span[role="button"]') as HTMLElement;
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      // The real card (now hidden via opacity while dragging) has
      // collapsed -- its own Markdown editor/toolbar is gone.
      const realCard = screen.getByTestId("module-card-module-1");
      expect(
        realCard.querySelector('[role="toolbar"]'),
      ).not.toBeInTheDocument();

      // The floating overlay preview is a second, separate mount of the
      // same card -- it must also never show the editor, regardless of
      // its own fresh `expanded` default.
      const overlayCard = screen.getByTestId("module-card-overlay-module-1");
      expect(container.contains(overlayCard)).toBe(false);
      expect(
        overlayCard.querySelector('[role="toolbar"]'),
      ).not.toBeInTheDocument();

      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "Escape", key: "Escape" });
    });

    it("keeps the card collapsed once the drag actually completes (a drop), instead of re-expanding it", async () => {
      stubItemRects(["module-1", "module-2"]);
      const onReorder = vi.fn();
      renderPanel({ onReorder });
      await screen.findAllByRole("toolbar");

      const handle = screen
        .getByTestId("module-card-module-1")
        .querySelector('span[role="button"]') as HTMLElement;
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      // Confirms the drop actually completed (same mechanics as the
      // existing "reorders items via keyboard drag" test above) -- so this
      // is asserting the post-drop state, not a drag that silently never
      // started.
      expect(onReorder).toHaveBeenCalledWith([ITEMS[1], ITEMS[0]]);

      // The overlay's drop animation (dnd-kit's own default `DragOverlay`
      // exit transition) keeps its last content mounted for a moment even
      // after the drop resolves -- wait it out rather than asserting
      // against a false-positive duplicate.
      await vi.waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Module 1" }),
        ).toHaveLength(1);
      });
      expect(
        screen
          .getByRole("button", { name: "Module 1" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
    });

    it("the overlay preview reserves Delete/AI Assistant/Translate for every dragged card, since SourceModulesPanel always wires all three", async () => {
      stubItemRects(["module-1", "module-2"]);
      renderPanel();
      await screen.findAllByRole("toolbar");

      const handle = screen
        .getByTestId("module-card-module-1")
        .querySelector('span[role="button"]') as HTMLElement;
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      const overlayCard = screen.getByTestId("module-card-overlay-module-1");
      expect(
        overlayCard.querySelector('[aria-label="Delete Module 1"]'),
      ).toBeInTheDocument();
      expect(
        overlayCard.querySelector('[aria-label="AI Assistant"]'),
      ).toBeInTheDocument();
      expect(
        overlayCard.querySelector('[aria-label="Translate to English"]'),
      ).toBeInTheDocument();

      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "Escape", key: "Escape" });
    });
  });
});
