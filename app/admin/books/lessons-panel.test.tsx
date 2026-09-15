import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LESSON_FIXTURES } from "./lesson-fixtures";
import { LessonsPanel } from "./lessons-panel";

const LESSONS = [
  { ...LESSON_FIXTURES[0], id: "lesson-1", title: { ar: "", en: "Intro" } },
  { ...LESSON_FIXTURES[1], id: "lesson-2", title: { ar: "", en: "" } },
];

// Same rect-stubbing approach as item-list.test.tsx/sortable-list.test.tsx --
// dnd-kit's keyboard coordinate math needs real-ish rects.
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

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof LessonsPanel>> = {},
) {
  return render(
    <MantineProvider>
      <LessonsPanel
        lessons={LESSONS}
        onReorderLessons={vi.fn()}
        onAddLesson={vi.fn()}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("LessonsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the Lessons title and a pluralized lesson count subtitle", () => {
    renderPanel();

    expect(screen.getByText("Lessons")).toBeInTheDocument();
    expect(screen.getByText("2 lessons")).toBeInTheDocument();
  });

  it("uses the singular 'lesson' for a single lesson", () => {
    renderPanel({ lessons: [LESSONS[0]] });

    expect(screen.getByText("1 lesson")).toBeInTheDocument();
  });

  it("renders each lesson's title, falling back to Lesson N when blank", () => {
    renderPanel();

    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Lesson 2")).toBeInTheDocument();
  });

  it("renders lessons in the given order", () => {
    renderPanel();

    expect(
      screen
        .getAllByTestId(/^list-item-/)
        .map((el) => el.getAttribute("data-testid")),
    ).toEqual(["list-item-lesson-1", "list-item-lesson-2"]);
  });

  it("shows the empty-state copy when there are no lessons", () => {
    renderPanel({ lessons: [] });

    expect(
      screen.getByText("This module has no lessons yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add lesson" })).toBeEnabled();
  });

  it("has no edit or delete actions on any row (out of scope for ANA-111)", () => {
    renderPanel();

    expect(
      screen.queryByRole("button", { name: /Edit/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete/ }),
    ).not.toBeInTheDocument();
  });

  it("calls onAddLesson, not onReorderLessons, when Add lesson is clicked", () => {
    const onAddLesson = vi.fn();
    const onReorderLessons = vi.fn();
    renderPanel({ onAddLesson, onReorderLessons });

    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(onAddLesson).toHaveBeenCalledWith();
    expect(onReorderLessons).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables Add lesson while addDisabled is true", () => {
    renderPanel({ addDisabled: true });

    expect(screen.getByRole("button", { name: "Add lesson" })).toBeDisabled();
  });

  it("shows the owning page's error between the list and the Add footer", () => {
    renderPanel({ error: "Something went wrong." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
  });

  it("reorders via the keyboard and reports the new order through onReorderLessons", async () => {
    const onReorderLessons = vi.fn();
    renderPanel({ onReorderLessons });
    stubItemRects(["lesson-1", "lesson-2"]);

    const grip = document.querySelector(
      '[data-testid="list-item-lesson-2"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onReorderLessons).toHaveBeenCalledWith([LESSONS[1], LESSONS[0]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("suspends dragging while reorderDisabled is true, without removing the grip", () => {
    renderPanel({ reorderDisabled: true });

    const grip = document.querySelector(
      '[data-testid="list-item-lesson-1"] [aria-hidden="true"]',
    );
    expect(grip).toBeInTheDocument();
    expect(grip).not.toHaveAttribute("tabindex");
  });
});
