import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TempModule } from "./import-source-types";
import { ModuleList } from "./module-list";

const MODULES: TempModule[] = [
  { id: "module-1", text: "First module text" },
  { id: "module-2", text: "Second module text" },
];

// dnd-kit's keyboard coordinate math needs real-ish rects to know which
// direction is "up"/"down" -- same stubbing approach as
// components/ui/item-list.test.tsx's stubItemRects.
function stubItemRects(order: string[], itemHeight = 120) {
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
        right: 400,
        width: 400,
        height: itemHeight,
        x: 0,
        y: top,
        toJSON() {},
      } as DOMRect;
    },
  );
}

function renderList(onModulesChange = vi.fn()) {
  render(
    <MantineProvider>
      <ModuleList modules={MODULES} onModulesChange={onModulesChange} />
    </MantineProvider>,
  );
  return onModulesChange;
}

describe("ModuleList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the dragged module's full text in the drag overlay, not just its header", async () => {
    // Regression test: the overlay used to render only the card header,
    // which visibly "shrank" a dragged module down to a thin bar while its
    // siblings stayed full height (found via manual browser testing -- see
    // PR notes). Reproducing the size mismatch itself needs real layout, so
    // this asserts the fix's actual mechanism instead: the overlay carries
    // a read-only copy of the dragged module's text alongside its header.
    renderList();
    stubItemRects(["module-1", "module-2"]);

    const header = screen.getByText("Module 1").closest("[aria-expanded]")!;
    (header as HTMLElement).focus();
    fireEvent.keyDown(header, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const matches = screen.getAllByDisplayValue("First module text");
    // One is the real (now-hidden-via-opacity) card's editable textarea,
    // the other is the overlay's read-only copy.
    expect(matches).toHaveLength(2);
    expect(matches.some((el) => el.hasAttribute("readonly"))).toBe(true);

    fireEvent.keyDown(header, { code: "Escape", key: "Escape" });
  });

  it("reorders via the keyboard and reports the new order, without toggling either card's expanded state", async () => {
    const onModulesChange = renderList();
    stubItemRects(["module-1", "module-2"]);

    const header = screen.getByText("Module 1").closest("[aria-expanded]")!;
    (header as HTMLElement).focus();
    fireEvent.keyDown(header, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(header, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(header, { code: "Space", key: " " });

    expect(onModulesChange).toHaveBeenCalledWith([MODULES[1], MODULES[0]]);
    expect(screen.getByLabelText("Module 1 text")).toBeInTheDocument();
    expect(screen.getByLabelText("Module 2 text")).toBeInTheDocument();
  });
});
