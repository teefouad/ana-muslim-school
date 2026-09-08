import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import type { TranslatableString } from "@/lib/learning-content/translatable-string";
import { SourceModulesPanel } from "./source-modules-panel";

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
    ...overrides,
  };

  render(
    <MantineProvider>
      <SourceModulesPanel<Item> {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("SourceModulesPanel", () => {
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
});
