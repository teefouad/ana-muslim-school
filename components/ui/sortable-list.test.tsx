import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { ItemList } from "./item-list";

interface DemoItem {
  id: string;
  label: string;
}

const items: DemoItem[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

// Same stubbing approach as item-list.test.tsx's stubItemRects -- dnd-kit's
// keyboard coordinate math needs real-ish rects.
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

describe("SortableList", () => {
  it("portals the drag overlay to document.body, escaping any transformed ancestor (e.g. a Mantine Modal's content)", async () => {
    // Regression test: `@dnd-kit/core`'s DragOverlay positions itself with
    // plain `position: fixed`, which resolves against the nearest ancestor
    // with a `transform` instead of the viewport (CSS containing-block
    // spec) -- and Mantine's Modal.Content carries exactly that (a
    // permanent `transform: translateY(0px)`, even once the open animation
    // settles). Any SortableList used inside a Modal (e.g. ANA-68's Module
    // builder) rendered its dragged item offset from the cursor by however
    // far the modal sat from the viewport's top-left corner -- confirmed by
    // reproducing this exact CSS setup with Playwright. This wraps the list
    // in an equivalent transformed ancestor and asserts the overlay ends up
    // outside it (a descendant of document.body instead), which is what
    // actually fixes the offset.
    stubItemRects(["a", "b"]);
    const { container } = render(
      <MantineProvider>
        <div style={{ transform: "translateY(0px)" }}>
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
          />
        </div>
      </MantineProvider>,
    );

    const grip = document.querySelector(
      '[data-testid="list-item-a"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // One "Alpha" is the real (now hidden-via-opacity) row, still inside
    // the transformed wrapper; the other is the overlay's copy.
    const overlayText = screen
      .getAllByText("Alpha")
      .find((el) => !container.contains(el));
    expect(overlayText).toBeTruthy();
    expect(document.body.contains(overlayText!)).toBe(true);

    fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });
  });
});
