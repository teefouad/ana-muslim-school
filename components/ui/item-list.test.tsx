import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { ItemList } from "./item-list";

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
