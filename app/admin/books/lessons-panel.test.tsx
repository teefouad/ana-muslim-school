import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { buildLessonFixture } from "./lesson-fixtures";
import { LessonsPanel } from "./lessons-panel";
import type { MockLesson } from "./mock-lessons";

const LESSONS: MockLesson[] = [
  buildLessonFixture({
    id: "lesson-1",
    title: { ar: "Introduction", en: "" },
    position: 0,
  }),
  buildLessonFixture({
    id: "lesson-2",
    title: { ar: "", en: "" },
    position: 1,
  }),
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
        onEditLesson={vi.fn()}
        onDeleteLesson={vi.fn()}
        onNewLesson={vi.fn()}
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

  it("exposes edit and delete icon actions on every row via ItemList", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Edit Introduction" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Introduction" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Lesson 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Lesson 2" }),
    ).toBeInTheDocument();
  });

  it("a single click on a row does not open the Lesson (Edit is the only entry point, ANA-115)", () => {
    const onEditLesson = vi.fn();
    renderPanel({ onEditLesson });

    fireEvent.click(screen.getByText("Introduction"));

    expect(onEditLesson).not.toHaveBeenCalled();
  });

  it("calls onEditLesson with the clicked lesson's Edit action", () => {
    const onEditLesson = vi.fn();
    renderPanel({ onEditLesson });

    fireEvent.click(screen.getByRole("button", { name: "Edit Introduction" }));

    expect(onEditLesson).toHaveBeenCalledWith(LESSONS[0]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a double click on a row does not call onEditLesson either (ANA-115 PR review: Edit is the only entry point)", () => {
    const onEditLesson = vi.fn();
    renderPanel({ onEditLesson });

    fireEvent.doubleClick(screen.getByText("Introduction"));

    expect(onEditLesson).not.toHaveBeenCalled();
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

  describe("New Lesson (ANA-115 PR review: local navigation only, no request)", () => {
    it("calls onNewLesson, not onLessonsChange, when New Lesson is clicked", () => {
      const onNewLesson = vi.fn();
      const onLessonsChange = vi.fn();
      renderPanel({ onNewLesson, onLessonsChange });

      fireEvent.click(screen.getByRole("button", { name: "New Lesson" }));

      expect(onNewLesson).toHaveBeenCalledWith();
      expect(onLessonsChange).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("Delete lesson (ANA-115, frontend-only local removal)", () => {
    it("shows a confirmation dialog instead of deleting immediately", () => {
      const onDeleteLesson = vi.fn();
      renderPanel({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Delete lesson?" }),
      ).toBeInTheDocument();
      expect(onDeleteLesson).not.toHaveBeenCalled();
    });

    it("calls onDeleteLesson once confirmed, with no network request", () => {
      const onDeleteLesson = vi.fn();
      renderPanel({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      expect(onDeleteLesson).toHaveBeenCalledWith(LESSONS[0]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("makes no call when canceled", () => {
      const onDeleteLesson = vi.fn();
      renderPanel({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onDeleteLesson).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Delete lesson?" }),
      ).not.toBeInTheDocument();
    });
  });
});
