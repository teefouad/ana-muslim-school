import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { LessonsPanel } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";

const LESSONS: MockLesson[] = [
  {
    id: "lesson-1",
    title: { ar: "Introduction", en: "" },
    description: { ar: "", en: "" },
    type: "text",
    position: 0,
    isPublished: false,
  },
  {
    id: "lesson-2",
    title: { ar: "", en: "" },
    description: { ar: "", en: "" },
    type: "text",
    position: 1,
    isPublished: false,
  },
];

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// ported from item-list.test.tsx's identical helper.
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
        onLessonsChange={vi.fn()}
        {...overrides}
      />
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("renders each lesson in the provided order, falling back to Lesson N when blank", () => {
    renderPanel();

    const rows = screen.getAllByTestId(/^list-item-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "list-item-lesson-1",
      "list-item-lesson-2",
    ]);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Lesson 2")).toBeInTheDocument();
  });

  it("shows the empty-state copy and no lesson rows when there are no lessons", () => {
    renderPanel({ lessons: [] });

    expect(
      screen.getByText("This module has no lessons yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
  });

  it("exposes no edit or delete actions on any row (selection/editing/deletion out of scope)", () => {
    renderPanel();

    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("fires onSelectLesson with the clicked Lesson", () => {
    const onSelectLesson = vi.fn();
    renderPanel({ onSelectLesson });

    fireEvent.click(screen.getByText("Introduction"));

    expect(onSelectLesson).toHaveBeenCalledWith(LESSONS[0]);
  });

  it("renders the selected Lesson's row distinguished from the rest", () => {
    renderPanel({ selectedLessonId: "lesson-2" });

    expect(screen.getByTestId("list-item-lesson-2")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByTestId("list-item-lesson-1")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("reorders via the keyboard and reports the new order through onLessonsChange, without a network request", async () => {
    const onLessonsChange = vi.fn();
    renderPanel({ onLessonsChange });
    stubItemRects(["lesson-1", "lesson-2"]);

    const grip = document.querySelector(
      '[data-testid="list-item-lesson-2"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onLessonsChange).toHaveBeenCalledWith([LESSONS[1], LESSONS[0]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds a new Lesson with position 2 through onLessonsChange when Add lesson is clicked, without a network request", () => {
    const onLessonsChange = vi.fn();
    renderPanel({ onLessonsChange, lessons: [] });

    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(onLessonsChange).toHaveBeenCalledTimes(1);
    const [added] = onLessonsChange.mock.calls[0][0] as MockLesson[];
    expect(added.position).toBe(2);
    expect(added.id).toEqual(expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("appends the new Lesson after any existing lessons", () => {
    const onLessonsChange = vi.fn();
    renderPanel({ onLessonsChange });

    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    const nextLessons = onLessonsChange.mock.calls[0][0] as MockLesson[];
    expect(nextLessons).toHaveLength(3);
    expect(nextLessons.slice(0, 2)).toEqual(LESSONS);
  });
});
