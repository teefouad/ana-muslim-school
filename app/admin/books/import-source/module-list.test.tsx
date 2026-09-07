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

  it("gives the drag overlay its own elevation and a faster settle transition for siblings", async () => {
    // Regression test: with dnd-kit's default 200ms sibling transition and
    // no visual distinction between the overlay and the list, the overlay
    // (which tracks the cursor with zero lag) could end up rendered exactly
    // on top of a still-settling sibling -- since both share the same flat,
    // opaque background, the sibling underneath became completely invisible
    // for a stretch of the drag (found via manual browser testing -- see PR
    // notes). Reproducing the real visual collision needs real layout, so
    // this asserts the fix's two actual mechanisms instead: a shorter
    // sibling transition (less time for the two to visually coincide) and
    // the overlay's own elevation class (so even a partial overlap reads as
    // "on top of", not "merged into").
    renderList();
    stubItemRects(["module-1", "module-2"]);

    const header = screen.getByText("Module 1").closest("[aria-expanded]")!;
    (header as HTMLElement).focus();
    fireEvent.keyDown(header, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const settlingSibling = screen
      .getByText("Module 2")
      .closest('[data-testid^="module-card-"]') as HTMLElement;
    expect(settlingSibling.style.transition).toContain("120ms");

    const overlayCard = screen
      .getAllByText(/^Module 1$/)
      .map((el) => el.closest('[class*="card"]'))
      .find((el) => el?.className.includes("overlayCard"));
    expect(overlayCard).toBeTruthy();

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
