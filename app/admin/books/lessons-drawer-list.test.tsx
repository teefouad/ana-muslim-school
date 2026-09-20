import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import type { Lesson } from "@/lib/lessons/types";
import { buildLessonFixture } from "./lesson-fixtures";
import { LessonsDrawerList } from "./lessons-drawer-list";

const LESSONS: Lesson[] = [
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
// ported from lessons-panel.test.tsx's identical helper.
function stubItemRects(order: string[], itemHeight = 60) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const container = this.closest('[data-testid^="lessons-drawer-card-"]');
      const id = container
        ?.getAttribute("data-testid")
        ?.replace("lessons-drawer-card-", "");
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

function renderList(
  overrides: Partial<React.ComponentProps<typeof LessonsDrawerList>> = {},
) {
  return render(
    <MantineProvider>
      <LessonsDrawerList
        lessons={LESSONS}
        onReorder={vi.fn()}
        onEditLesson={vi.fn()}
        onDeleteLesson={vi.fn().mockResolvedValue(undefined)}
        {...overrides}
      />
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LessonsDrawerList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders each lesson as a minimal card, in order, falling back to Lesson N when blank", () => {
    renderList();

    const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "lessons-drawer-card-lesson-1",
      "lessons-drawer-card-lesson-2",
    ]);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Lesson 2")).toBeInTheDocument();
  });

  it("renders no separate list header -- no title/count heading above the cards", () => {
    renderList();

    expect(screen.queryByText("Lessons")).not.toBeInTheDocument();
    expect(screen.queryByText("2 lessons")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("gives every card a drag handle plus Edit and Delete actions", () => {
    renderList();

    const card = screen.getByTestId("lessons-drawer-card-lesson-1");
    expect(card.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Introduction" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Introduction" }),
    ).toBeInTheDocument();
  });

  it("shows the empty-state copy and no cards when there are no lessons", () => {
    renderList({ lessons: [] });

    expect(
      screen.getByText("This module has no lessons yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
  });

  it("shows skeleton rows, not real cards, while loading", () => {
    renderList({ loading: true });

    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(/^lessons-drawer-card-/),
    ).not.toBeInTheDocument();
  });

  it("calls onEditLesson with the clicked lesson's Edit action", () => {
    const onEditLesson = vi.fn();
    renderList({ onEditLesson });

    fireEvent.click(screen.getByRole("button", { name: "Edit Introduction" }));

    expect(onEditLesson).toHaveBeenCalledWith(LESSONS[0]);
  });

  it("calls onEditLesson when a card is double-clicked (ANA-129, matching ModulesPanel)", () => {
    const onEditLesson = vi.fn();
    renderList({ onEditLesson });

    fireEvent.doubleClick(screen.getByText("Introduction"));

    expect(onEditLesson).toHaveBeenCalledWith(LESSONS[0]);
  });

  it("reorders via the keyboard, updating only the local order (no network request)", async () => {
    const onReorder = vi.fn();
    renderList({ onReorder });
    stubItemRects(["lesson-1", "lesson-2"]);

    const grip = screen
      .getByTestId("lessons-drawer-card-lesson-2")
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(onReorder).toHaveBeenCalledWith([LESSONS[1], LESSONS[0]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("Delete lesson (reuses the existing Lesson delete behavior)", () => {
    it("shows a confirmation dialog instead of deleting immediately", () => {
      const onDeleteLesson = vi.fn().mockResolvedValue(undefined);
      renderList({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Delete lesson?" }),
      ).toBeInTheDocument();
      expect(onDeleteLesson).not.toHaveBeenCalled();
    });

    it("calls onDeleteLesson once confirmed", async () => {
      const onDeleteLesson = vi.fn().mockResolvedValue(undefined);
      renderList({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      await vi.waitFor(() =>
        expect(onDeleteLesson).toHaveBeenCalledWith(LESSONS[0]),
      );
    });

    it("keeps the card and shows an error when the delete request fails", async () => {
      const onDeleteLesson = vi
        .fn()
        .mockRejectedValue(new Error("Lesson not found."));
      renderList({ onDeleteLesson });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
      expect(screen.getByText("Introduction")).toBeInTheDocument();
    });
  });
});
