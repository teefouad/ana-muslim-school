import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import {
  LessonBreakConfig,
  type LessonBreakConfigProps,
} from "./lesson-break-config";
import type { LessonAzkarFieldEntry } from "./lesson-fields";

const ENTRIES: LessonAzkarFieldEntry[] = [
  { id: "entry-1", text: { ar: "سبحان الله", en: "Subhan Allah" }, repeat: 33 },
  { id: "entry-2", text: { ar: "الحمد لله", en: "Alhamdulillah" }, repeat: 33 },
];

function renderConfig(overrides: Partial<LessonBreakConfigProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MantineProvider>
      <LessonBreakConfig value={ENTRIES} onChange={onChange} {...overrides} />
    </MantineProvider>,
  );
  return { onChange, ...utils };
}

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// without this, every row would appear to occupy the same point and no
// reorder could ever resolve to a different target (see item-list.test.tsx's
// identical helper).
function stubItemRects(order: string[], itemHeight = 60) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const container = this.closest('[data-testid^="break-entry-"]');
      const id = container
        ?.getAttribute("data-testid")
        ?.replace("break-entry-", "");
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

describe("LessonBreakConfig", () => {
  it("seeds every entry's Arabic text and Repeat count from value", () => {
    renderConfig();

    expect(screen.getByDisplayValue("سبحان الله")).toBeInTheDocument();
    expect(screen.getByDisplayValue("الحمد لله")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("33")).toHaveLength(2);
  });

  it("shows the empty state, with Add entry still available, when there are no entries", () => {
    renderConfig({ value: [] });

    expect(
      screen.getByText("This lesson has no break entries yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add entry" }),
    ).toBeInTheDocument();
  });

  it("appends a new blank entry (repeat 1) when Add entry is clicked", () => {
    const { onChange } = renderConfig();

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(onChange).toHaveBeenCalledWith([
      ...ENTRIES,
      expect.objectContaining({ text: { ar: "", en: "" }, repeat: 1 }),
    ]);
  });

  it("edits an entry's Arabic text without touching other entries", () => {
    const { onChange } = renderConfig();

    fireEvent.change(screen.getByDisplayValue("سبحان الله"), {
      target: { value: "سبحان الله وبحمده" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { ...ENTRIES[0], text: { ar: "سبحان الله وبحمده", en: "Subhan Allah" } },
      ENTRIES[1],
    ]);
  });

  it("edits an entry's Repeat count without touching other entries", () => {
    const { onChange } = renderConfig();

    fireEvent.change(screen.getAllByDisplayValue("33")[1], {
      target: { value: "10" },
    });

    expect(onChange).toHaveBeenCalledWith([
      ENTRIES[0],
      { ...ENTRIES[1], repeat: 10 },
    ]);
  });

  it("deletes only the targeted entry after confirming (ANA-129)", () => {
    const { onChange } = renderConfig();

    fireEvent.click(screen.getByRole("button", { name: "Delete سبحان الله" }));
    const dialog = screen.getByRole("dialog", { name: "Delete entry 1?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(onChange).toHaveBeenCalledWith([ENTRIES[1]]);
  });

  it("cancelling the delete confirmation keeps the entry (ANA-129)", () => {
    const { onChange } = renderConfig();

    fireEvent.click(screen.getByRole("button", { name: "Delete سبحان الله" }));
    const dialog = screen.getByRole("dialog", { name: "Delete entry 1?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reorders entries via the keyboard and reports the new order through onChange", async () => {
    const { onChange } = renderConfig();
    stubItemRects(["entry-1", "entry-2"]);

    const grip = screen.getByRole("button", {
      name: "Reorder الحمد لله",
    });
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onChange).toHaveBeenCalledWith([ENTRIES[1], ENTRIES[0]]);
  });
});
