import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { ItemList } from "./item-list";
import styles from "./item-list.module.css";

interface DemoItem {
  id: string;
  label: string;
}

const items: DemoItem[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

function renderList(
  overrides: Partial<React.ComponentProps<typeof ItemList<DemoItem>>> = {},
) {
  return render(
    <MantineProvider>
      <ItemList
        title="Demo list"
        subtitle="2 items"
        items={items}
        getItemId={(item) => item.id}
        renderItem={(item) => item.label}
        emptyState="Nothing here."
        sortable
        addLabel="Add item"
        onAdd={() => {}}
        {...overrides}
      />
    </MantineProvider>,
  );
}

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// without this, every row would appear to occupy the same point and no
// reorder could ever resolve to a different target.
function stubItemRects(order: string[], itemHeight = 60) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const container = this.closest('[data-testid^="list-item-"]');
      const id = container
        ?.getAttribute("data-testid")
        ?.replace("list-item-", "");
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemList", () => {
  test("renders the title, subtitle, and each item's content", () => {
    renderList();

    expect(screen.getByText("Demo list")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  test("shows the empty state instead of the list when there are no items", () => {
    renderList({ items: [] });

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  test("keeps the Add button available when items is empty", () => {
    renderList({ items: [] });

    expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled();
  });

  test("clicking a row fires onItemClick with the item and its index", () => {
    const onItemClick = vi.fn();
    renderList({ onItemClick });

    fireEvent.click(screen.getByText("Beta"));

    expect(onItemClick).toHaveBeenCalledWith(items[1], 1);
  });

  test("a row has no click behavior when onItemClick is omitted", () => {
    renderList();

    // Row content renders as plain text, not a button, when there is no
    // click handler to wire up.
    expect(
      screen.queryByRole("button", { name: "Alpha" }),
    ).not.toBeInTheDocument();
  });

  test("double-clicking a row fires onItemDoubleClick with the item and its index (ANA-103)", () => {
    const onItemDoubleClick = vi.fn();
    renderList({ onItemDoubleClick });

    fireEvent.doubleClick(screen.getByText("Beta"));

    expect(onItemDoubleClick).toHaveBeenCalledWith(items[1], 1);
  });

  test("onItemDoubleClick is independent of onItemClick -- a plain click does not fire it", () => {
    const onItemClick = vi.fn();
    const onItemDoubleClick = vi.fn();
    renderList({ onItemClick, onItemDoubleClick });

    fireEvent.click(screen.getByText("Alpha"));

    expect(onItemClick).toHaveBeenCalledWith(items[0], 0);
    expect(onItemDoubleClick).not.toHaveBeenCalled();
  });

  test("a row has no double-click behavior when onItemDoubleClick is omitted", () => {
    const onItemDoubleClick = vi.fn();
    renderList();

    fireEvent.doubleClick(screen.getByText("Alpha"));

    expect(onItemDoubleClick).not.toHaveBeenCalled();
  });

  test("no edit/delete actions render when their handlers are omitted", () => {
    renderList();

    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking edit fires onEditItem with the item and its index, using getEditLabel for the accessible name", () => {
    const onEditItem = vi.fn();
    renderList({
      onEditItem,
      getEditLabel: (item) => `Edit ${item.label}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Alpha" }));

    expect(onEditItem).toHaveBeenCalledWith(items[0], 0);
  });

  test("clicking delete fires onDeleteItem with the item and its index, using getDeleteLabel for the accessible name", () => {
    const onDeleteItem = vi.fn();
    renderList({
      onDeleteItem,
      getDeleteLabel: (item) => `Remove ${item.label}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));

    expect(onDeleteItem).toHaveBeenCalledWith(items[0], 0);
  });

  test("edit and delete actions do not fire onItemClick", () => {
    const onItemClick = vi.fn();
    const onEditItem = vi.fn();
    const onDeleteItem = vi.fn();
    renderList({
      onItemClick,
      onEditItem,
      onDeleteItem,
      getEditLabel: (item) => `Edit ${item.label}`,
      getDeleteLabel: (item) => `Remove ${item.label}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));

    expect(onItemClick).not.toHaveBeenCalled();
    expect(onEditItem).toHaveBeenCalledTimes(1);
    expect(onDeleteItem).toHaveBeenCalledTimes(1);
  });

  test("editDisabled disables every edit action; deleteDisabled disables every delete action", () => {
    renderList({
      onEditItem: () => {},
      getEditLabel: (item) => `Edit ${item.label}`,
      editDisabled: true,
      onDeleteItem: () => {},
      getDeleteLabel: (item) => `Remove ${item.label}`,
      deleteDisabled: true,
    });

    expect(screen.getByRole("button", { name: "Edit Alpha" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeDisabled();
  });

  test("deletingItemId disables just that row's delete action", () => {
    renderList({
      onDeleteItem: () => {},
      getDeleteLabel: (item) => `Remove ${item.label}`,
      deletingItemId: "a",
    });

    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove Beta" }),
    ).not.toBeDisabled();
  });

  test("the Add button uses addLabel, fires onAdd, and respects addDisabled", () => {
    const onAdd = vi.fn();
    renderList({ onAdd, addDisabled: true });

    const addButton = screen.getByRole("button", { name: "Add item" });
    expect(addButton).toBeDisabled();

    fireEvent.click(addButton);
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("renders the error slot as an alert when provided", () => {
    renderList({ error: "Something failed." });

    expect(screen.getByRole("alert")).toHaveTextContent("Something failed.");
  });

  test("a plain pointer click on the drag grip does not fire onReorder", () => {
    const onReorder = vi.fn();
    renderList({ onReorder });
    stubItemRects(["a", "b"]);

    // The grip carries dnd-kit's drag listeners but no click semantics of
    // its own -- a plain mouse down/up with no movement must never resolve
    // to a reorder (dnd-kit's pointer activation distance).
    const grip = document.querySelector(
      '[data-testid="list-item-a"] [aria-hidden="true"]',
    ) as HTMLElement;
    fireEvent.pointerDown(grip);
    fireEvent.pointerUp(grip);

    expect(onReorder).not.toHaveBeenCalled();
  });

  test("reorders via the keyboard and reports the new order through onReorder", async () => {
    const onReorder = vi.fn();
    renderList({ onReorder });
    stubItemRects(["a", "b"]);

    const grip = document.querySelector(
      '[data-testid="list-item-b"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onReorder).toHaveBeenCalledWith([items[1], items[0]]);
  });

  test("when sortable is false, rows have no drag grip and no reorder is possible", () => {
    const onReorder = vi.fn();
    renderList({ sortable: false, onReorder });

    expect(
      document.querySelector('[data-testid="list-item-a"] svg'),
    ).not.toBeInTheDocument();
  });

  test("reorderDisabled suspends dragging without removing the grip", () => {
    renderList({ reorderDisabled: true });

    const grip = document.querySelector(
      '[data-testid="list-item-a"] [aria-hidden="true"]',
    );
    expect(grip).toBeInTheDocument();
    expect(grip).not.toHaveAttribute("tabindex");
  });

  test("distinct ItemList instances never collide on their DndContext-derived aria ids", () => {
    render(
      <MantineProvider>
        <ItemList
          title="List 1"
          items={items}
          getItemId={(item) => item.id}
          renderItem={(item) => item.label}
          emptyState="Nothing here."
          sortable
          addLabel="Add item"
          onAdd={() => {}}
        />
        <ItemList
          title="List 2"
          items={items}
          getItemId={(item) => item.id}
          renderItem={(item) => item.label}
          emptyState="Nothing here."
          sortable
          addLabel="Add item"
          onAdd={() => {}}
        />
      </MantineProvider>,
    );

    const rows = screen.getAllByTestId("list-item-a");
    expect(rows).toHaveLength(2);
  });

  describe("drag hit area and overlay fidelity (ANA-80)", () => {
    // Finds the floating DragOverlay's copy of a row by its rendered text,
    // as distinct from the idle (now opacity:0) original still sitting
    // inside the list -- same technique as sortable-list.test.tsx's own
    // "portals the drag overlay to document.body" regression test.
    function overlayRowFor(text: string, container: HTMLElement) {
      const match = screen
        .getAllByText(text)
        .map((el) => el.closest(`.${CSS.escape(styles.row)}`))
        .find((el): el is Element => Boolean(el) && !container.contains(el));

      return match as HTMLElement;
    }

    test("the grip's own padding -- not the row's -- carries the drag hit area, so dnd-kit's listeners cover the full visible grip region instead of just the 16px icon", () => {
      renderList();

      const grip = document.querySelector(
        '[data-testid="list-item-a"] [aria-hidden="true"]',
      ) as HTMLElement;
      const row = grip.closest(`.${CSS.escape(styles.row)}`) as HTMLElement;
      const content = row.querySelector(
        `.${CSS.escape(styles.content)}`,
      ) as HTMLElement;

      expect(grip.classList.contains(styles.grip)).toBe(true);
      // `.contentNoGrip` (the row's left inset, reassigned to `.content`)
      // only applies on the non-sortable path below, where there's no grip
      // to own that space instead -- confirming the grip is the one
      // carrying it here.
      expect(content.classList.contains(styles.contentNoGrip)).toBe(false);
    });

    test("the non-sortable row (no grip) keeps its own left inset on .content instead of leaving it stranded on the grip", () => {
      renderList({ sortable: false });

      const row = screen.getByTestId("list-item-a");
      const content = row.querySelector(
        `.${CSS.escape(styles.content)}`,
      ) as HTMLElement;

      expect(content.classList.contains(styles.contentNoGrip)).toBe(true);
    });

    test("action buttons stay outside the grip and never start a drag when clicked", () => {
      const onReorder = vi.fn();
      const onEditItem = vi.fn();
      renderList({
        onReorder,
        onEditItem,
        getEditLabel: (item) => `Edit ${item.label}`,
      });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alpha" }));

      expect(onEditItem).toHaveBeenCalledTimes(1);
      expect(onReorder).not.toHaveBeenCalled();
    });

    test("the drag overlay reuses the exact same row/grip classes as the idle row, rendered as a div rather than a stray li outside the list", () => {
      const { container } = renderList();
      stubItemRects(["a", "b"]);

      const grip = document.querySelector(
        '[data-testid="list-item-a"] [aria-hidden="true"]',
      ) as HTMLElement;
      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });

      const overlayRow = overlayRowFor("Alpha", container);
      expect(overlayRow).toBeTruthy();
      expect(overlayRow.tagName).toBe("DIV");
      expect(overlayRow.classList.contains(styles.row)).toBe(true);
      expect(
        overlayRow.querySelector(`.${CSS.escape(styles.grip)}`),
      ).toBeTruthy();

      fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });
    });

    test("the drag overlay reserves the same disabled actions slot as the idle row when edit/delete are wired, instead of a narrower preview", () => {
      const onEditItem = vi.fn();
      const onDeleteItem = vi.fn();
      const { container } = renderList({
        onEditItem,
        getEditLabel: (item) => `Edit ${item.label}`,
        onDeleteItem,
        getDeleteLabel: (item) => `Remove ${item.label}`,
      });
      stubItemRects(["a", "b"]);

      const grip = document.querySelector(
        '[data-testid="list-item-a"] [aria-hidden="true"]',
      ) as HTMLElement;
      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });

      const overlayRow = overlayRowFor("Alpha", container);
      const overlayEdit = overlayRow.querySelector(
        'button[aria-label="Edit Alpha"]',
      ) as HTMLButtonElement;
      const overlayDelete = overlayRow.querySelector(
        'button[aria-label="Remove Alpha"]',
      ) as HTMLButtonElement;

      expect(overlayEdit).toBeTruthy();
      expect(overlayEdit).toBeDisabled();
      expect(overlayDelete).toBeTruthy();
      expect(overlayDelete).toBeDisabled();

      // Reserved for layout only -- never wired to the caller's real
      // handlers, so even a stray click can't act on the dragged item.
      fireEvent.click(overlayEdit);
      fireEvent.click(overlayDelete);
      expect(onEditItem).not.toHaveBeenCalled();
      expect(onDeleteItem).not.toHaveBeenCalled();

      fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });
    });

    test("the drag overlay is pinned to the dragged row's own measured width instead of stretching to fill document.body", () => {
      const { container } = renderList();
      stubItemRects(["a", "b"], 60);

      const grip = document.querySelector(
        '[data-testid="list-item-a"] [aria-hidden="true"]',
      ) as HTMLElement;
      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });

      const overlayRow = overlayRowFor("Alpha", container);
      // `stubItemRects` fixes every row's rect at `right: 300, width: 300`.
      expect(overlayRow).toHaveStyle({ width: "300px" });

      fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });
    });
  });

  test("uses list-item-{id} as the default row test id, or a caller-provided one", () => {
    const { rerender } = renderList();
    expect(screen.getByTestId("list-item-a")).toBeInTheDocument();

    rerender(
      <MantineProvider>
        <ItemList
          title="Demo list"
          items={items}
          getItemId={(item) => item.id}
          getItemTestId={(item) => `custom-${item.id}`}
          renderItem={(item) => item.label}
          emptyState="Nothing here."
          sortable
          addLabel="Add item"
          onAdd={() => {}}
        />
      </MantineProvider>,
    );
    expect(screen.getByTestId("custom-a")).toBeInTheDocument();
  });
});
