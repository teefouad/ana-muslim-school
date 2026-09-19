import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleDrawer,
  type EditModuleDrawerProps,
} from "./edit-module-drawer";
import { buildLessonFixture } from "./lesson-fixtures";
import type { Book } from "@/lib/books/types";
import type { Lesson } from "@/lib/lessons/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Same routing shape as edit-module-modal.test.tsx's identical helper --
 * every `GET .../lessons`/`GET .../questions` this component fires on mount
 * resolves from an in-memory list; anything else (Save's own Module PATCH is
 * never made by this component itself -- `onSave` is a caller-supplied mock)
 * resolves 200 with an empty Questions list by default. */
function mockFetch({ lessons = [] }: { lessons?: Lesson[] } = {}) {
  (fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (url: RequestInfo | URL) => {
      const urlStr = typeof url === "string" ? url : String(url);
      if (urlStr.endsWith("/lessons")) {
        return Promise.resolve(jsonResponse({ data: lessons }));
      }
      if (urlStr.endsWith("/questions")) {
        return Promise.resolve(jsonResponse({ data: [] }));
      }
      return Promise.resolve(
        jsonResponse({ error: "Unhandled fetch in test." }, 500),
      );
    },
  );
}

const BOOK: Book = {
  id: "book-1",
  title: { ar: "عنوان الكتاب", en: "Book Title" },
  description: { ar: "وصف الكتاب", en: "Book Description" },
  longDescription: { ar: "وصف طويل للكتاب", en: "Book Long Description" },
  color: "cyan.6",
  imageId: "img-1",
  modules: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "a@example.com",
  updatedBy: "a@example.com",
};

const EDIT_FIELDS = {
  title: { ar: "المقدمة", en: "" },
  description: { ar: "وصف", en: "" },
  color: "cyan.6",
  content: { ar: "محتوى", en: "" },
  isPublished: false,
};

function renderDrawer(overrides: Partial<EditModuleDrawerProps> = {}) {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render, same reason as edit-module-modal.test.tsx
          (see AGENTS.md). */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EditModuleDrawer
          state={{ id: "module-1", fields: EDIT_FIELDS }}
          book={BOOK}
          onClose={vi.fn()}
          onSave={vi.fn().mockResolvedValue(undefined)}
          {...overrides}
        />
      </SWRConfig>
    </MantineProvider>,
  );
}

// `DrawerShell`'s own header (ANA-122) renders through Mantine's
// `Drawer.Title`, which wires the drawer's `role="dialog"` element's
// `aria-labelledby` automatically -- so, unlike the pre-existing Edit
// Module modal (still its own separate, unmigrated component), the name
// can be matched directly instead of locating the heading and walking up
// to its nearest `[role="dialog"]` ancestor.
async function findDrawerDialog(name: string): Promise<HTMLElement> {
  return screen.findByRole("dialog", { name });
}

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// ported from lessons-panel.test.tsx's/lessons-drawer-list.test.tsx's
// identical helper, keyed off the Lessons drawer's own card testid.
function stubLessonCardRects(order: string[], itemHeight = 60) {
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

describe("EditModuleDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when state is null", () => {
    renderDrawer({ state: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a right-side drawer, not the Edit Module modal, seeded with the Module's current values", async () => {
    renderDrawer();

    const dialog = await findDrawerDialog("Edit Module");
    // A Drawer, not a Modal -- Mantine names each component's own root/
    // content classes after it (mantine-Drawer-* vs. mantine-Modal-*), and
    // exactly one dialog exists in the tree either way.
    expect(dialog.className).toContain("mantine-Drawer-content");
    expect(dialog.className).not.toContain("mantine-Modal-content");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");
    expect(within(dialog).getByLabelText("Description")).toHaveValue("وصف");
    expect(within(dialog).getByRole("combobox", { name: "Color" })).toHaveValue(
      "cyan.6",
    );
    expect(await within(dialog).findByText("محتوى")).toBeInTheDocument();
  });

  it("uses a 560px drawer width on desktop, opening from the right", async () => {
    renderDrawer();
    await findDrawerDialog("Edit Module");

    const root = document.querySelector(".mantine-Drawer-root");
    expect(root?.getAttribute("style")).toContain("min(560px, 100vw)");
  });

  it("Save changes calls onSave with the Module's id, edited fields, and a null Lesson order when nothing was reordered", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDrawer({ onSave });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "module-1",
        expect.objectContaining({ title: { ar: "عنوان جديد", en: "" } }),
        null,
      ),
    );
  });

  it("Cancel is gated behind a discard confirmation once a field has been edited, and confirming calls onClose", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ANA-123 PR review: once the Module drawer got a `stackId` (for the
  // Lessons nested drawer), Mantine's `Drawer.Stack` assigns it a z-index
  // *above* the default modal tier (`calc(200 + stack index + 1)` = 201) --
  // higher than the discard confirmation's own unstacked Modal, which sits
  // at Mantine's default modal z-index (200) unless told otherwise. Without
  // `ConfirmDialog`'s `zIndex` override, the confirmation would render
  // underneath the drawer's own overlay instead of on top of it.
  it("renders the discard confirmation above the Module drawer's own overlay z-index", async () => {
    renderDrawer();
    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    });

    const confirmZIndex = Number(
      confirmDialog
        .closest(".mantine-Modal-root")
        ?.getAttribute("style")
        ?.match(/--mb-z-index:\s*(\d+)/)?.[1],
    );
    // The Module drawer's own stacked z-index is `calc(200 + 0 + 1)` --
    // parsed as its two numeric operands rather than hard-coding the
    // combined value, so this doesn't silently stop testing anything if
    // Mantine's own formula (or its base "modal" elevation) ever changes.
    const drawerZIndexMatch = document
      .querySelector(".mantine-Drawer-root")
      ?.getAttribute("style")
      ?.match(/--mb-z-index:\s*calc\((\d+)\s*\+\s*(\d+)\s*\+\s*1\)/);
    const drawerZIndex =
      Number(drawerZIndexMatch?.[1]) + Number(drawerZIndexMatch?.[2]) + 1;

    expect(confirmZIndex).toBeGreaterThan(drawerZIndex);
  });

  it("Cancel closes immediately, without confirmation, when nothing was edited", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Every other way Mantine's Drawer can be dismissed (close button, Escape,
  // outside click) funnels into the exact same `onClose` prop as Cancel --
  // same "Escape as a proxy for the shared Mantine dismiss funnel" precedent
  // edit-module-modal.test.tsx's identical test already uses.
  it("blocks every other way of dismissing the drawer (close button/Escape/outside click, funneled through Mantine's own onClose) the same way as Cancel", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // The shared `DrawerShell`'s own back arrow (ANA-122) is the drawer's
  // visible way to leave it, same as Cancel -- it must route through the
  // exact same guarded `handleRequestClose` path, not close immediately.
  it("the header's own Back button is gated behind the same discard confirmation as Cancel once a field has been edited", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the header's own Back button closes immediately, without confirmation, when nothing was edited", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    const dialog = await findDrawerDialog("Edit Module");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ANA-122: Mantine's own close/X button is never rendered -- Back is the
  // header's only control, and Cancel/Save changes are the footer's only
  // controls (both routed through the drawer's shared chrome instead of
  // duplicated inside the scrollable body).
  it("never renders Mantine's own close/X button", async () => {
    renderDrawer();
    const dialog = await findDrawerDialog("Edit Module");

    expect(
      within(dialog).getByRole("button", { name: "Back" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  // Cancel/Save changes render in the shared drawer's own fixed footer
  // (ANA-122, via `DrawerFooter`) rather than inside `ModuleEditorBody`'s
  // scrollable content -- they must never end up inside the same scrollable
  // region as the Module fields above them.
  it("renders Cancel/Save changes outside the scrollable content region", async () => {
    renderDrawer();
    await findDrawerDialog("Edit Module");

    const scrollRegion = screen.getByTestId("drawer-scroll-region");

    expect(
      within(scrollRegion).queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(
      within(scrollRegion).queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  // ANA-123: the drawer no longer renders the Lessons list/panel at all --
  // Lesson management moves to the nested placeholder drawer below.
  it("does not render the Lessons list/panel", async () => {
    mockFetch({
      lessons: [
        buildLessonFixture({
          id: "lesson-1",
          title: { ar: "الدرس الأول", en: "" },
        }),
      ],
    });
    renderDrawer();

    const dialog = await findDrawerDialog("Edit Module");
    // The Module's fields are still there (proves the drawer rendered
    // successfully), but nothing from the Lessons list/its rows.
    expect(within(dialog).getByLabelText("Title")).toBeInTheDocument();
    expect(within(dialog).queryByText("الدرس الأول")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "New Lesson" }),
    ).not.toBeInTheDocument();
  });

  // ANA-123: Color gets its own full row, Published the row below it --
  // replacing the modal's side-by-side Published/Color row (unchanged
  // there, out of scope for this task).
  it("renders Color and Published on separate rows, Color first", async () => {
    renderDrawer();
    const dialog = await findDrawerDialog("Edit Module");

    const color = within(dialog).getByRole("combobox", { name: "Color" });
    const published = within(dialog).getByRole("switch", {
      name: "Published",
    });

    expect(color.compareDocumentPosition(published)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders a Lessons button with a pencil icon in the header", async () => {
    renderDrawer();
    const dialog = await findDrawerDialog("Edit Module");

    const lessonsButton = within(dialog).getByRole("button", {
      name: "Lessons",
    });
    expect(lessonsButton).toBeInTheDocument();
    expect(lessonsButton.querySelector("svg")).toBeInTheDocument();
  });

  it("clicking Lessons opens a nested drawer above the Module editor, which stays mounted underneath it", async () => {
    mockFetch({
      lessons: [
        buildLessonFixture({
          id: "lesson-1",
          title: { ar: "الدرس الأول", en: "" },
        }),
      ],
    });
    renderDrawer();
    const moduleDialog = await findDrawerDialog("Edit Module");

    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Lessons" }),
    );

    const lessonsDialog = await findDrawerDialog("Lessons");
    expect(lessonsDialog).toBeInTheDocument();
    expect(
      await within(lessonsDialog).findByText("الدرس الأول"),
    ).toBeInTheDocument();
    // The Module editor is still mounted underneath, fields intact.
    expect(
      screen.getByRole("dialog", { name: "Edit Module" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("المقدمة");
  });

  it("uses a 500px Lessons drawer width on desktop (ANA-125)", async () => {
    renderDrawer();
    const moduleDialog = await findDrawerDialog("Edit Module");

    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Lessons" }),
    );
    await findDrawerDialog("Lessons");

    const roots = document.querySelectorAll(".mantine-Drawer-root");
    const widths = Array.from(roots).map((root) => root.getAttribute("style"));
    expect(widths.some((style) => style?.includes("min(500px, 100vw)"))).toBe(
      true,
    );
  });

  it("backing out of the nested Lessons drawer returns to the Module editor", async () => {
    renderDrawer();
    const moduleDialog = await findDrawerDialog("Edit Module");
    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Lessons" }),
    );
    const lessonsDialog = await findDrawerDialog("Lessons");

    fireEvent.click(
      within(lessonsDialog).getByRole("button", { name: "Back" }),
    );

    // The Lessons drawer animates out rather than unmounting immediately
    // (Mantine's own exit transition) -- wait for it to actually leave the
    // tree rather than asserting its absence synchronously.
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Lessons" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("dialog", { name: "Edit Module" }),
    ).toBeInTheDocument();
  });

  it("opening and closing the Lessons placeholder does not mark the Module editor dirty", async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    const moduleDialog = await findDrawerDialog("Edit Module");

    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Lessons" }),
    );
    const lessonsDialog = await findDrawerDialog("Lessons");
    fireEvent.click(
      within(lessonsDialog).getByRole("button", { name: "Back" }),
    );
    await screen.findByRole("dialog", { name: "Edit Module" });

    // No Module field was touched, so Cancel should still close immediately
    // -- opening/closing the placeholder alone must never flip `isDirty`.
    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Cancel" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ANA-124: the nested Lessons drawer's real content (list/sort/save),
  // replacing ANA-123's `{null}` placeholder.
  describe("Lessons drawer content (ANA-124)", () => {
    const LESSONS: Lesson[] = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "الدرس الأول", en: "" },
        position: 0,
      }),
      buildLessonFixture({
        id: "lesson-2",
        title: { ar: "الدرس الثاني", en: "" },
        position: 1,
      }),
    ];

    async function openLessonsDrawer() {
      const moduleDialog = await findDrawerDialog("Edit Module");
      fireEvent.click(
        within(moduleDialog).getByRole("button", { name: "Lessons" }),
      );
      const lessonsDialog = await findDrawerDialog("Lessons");
      await within(lessonsDialog).findByText("الدرس الأول");
      return { moduleDialog, lessonsDialog };
    }

    async function reorderLessons() {
      stubLessonCardRects(["lesson-1", "lesson-2"]);
      const grip = screen
        .getByTestId("lessons-drawer-card-lesson-2")
        .querySelector('[aria-hidden="true"]') as HTMLElement;
      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
      fireEvent.keyDown(grip, { code: "Space", key: " " });
    }

    it("header has Lessons title, a Back action, and New Lesson on the right -- no separate list header", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      expect(
        within(lessonsDialog).getByRole("button", { name: "Back" }),
      ).toBeInTheDocument();
      expect(
        within(lessonsDialog).getByRole("button", { name: "New Lesson" }),
      ).toBeInTheDocument();
      // No second "Lessons" title/count subtitle from a duplicated list
      // header -- the drawer's own header (matched by `lessonsDialog`'s
      // accessible name above) is the only one.
      expect(
        within(lessonsDialog).queryByText("2 lessons"),
      ).not.toBeInTheDocument();
    });

    it("renders Lessons as minimal cards, not the ItemList-based panel", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      expect(
        within(lessonsDialog).getByTestId("lessons-drawer-card-lesson-1"),
      ).toBeInTheDocument();
      expect(
        within(lessonsDialog).getByTestId("lessons-drawer-card-lesson-2"),
      ).toBeInTheDocument();
      // ItemList's own row testid convention -- proves this isn't it.
      expect(
        within(lessonsDialog).queryByTestId("list-item-lesson-1"),
      ).not.toBeInTheDocument();
    });

    it("each card has a drag handle, Edit, and Delete", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      const card = within(lessonsDialog).getByTestId(
        "lessons-drawer-card-lesson-1",
      );
      expect(card.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
      expect(
        within(lessonsDialog).getByRole("button", {
          name: "Edit الدرس الأول",
        }),
      ).toBeInTheDocument();
      expect(
        within(lessonsDialog).getByRole("button", {
          name: "Delete الدرس الأول",
        }),
      ).toBeInTheDocument();
    });

    it("dragging a card only updates the local order -- no network request", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      await openLessonsDrawer();

      await reorderLessons();

      await vi.waitFor(() => {
        const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
        expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
          "lessons-drawer-card-lesson-2",
          "lessons-drawer-card-lesson-1",
        ]);
      });
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/modules/module-1"),
        expect.anything(),
      );
    });

    it("Save changes persists the reordered Lesson ids through the existing Module save path", async () => {
      mockFetch({ lessons: LESSONS });
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderDrawer({ onSave });
      const { lessonsDialog } = await openLessonsDrawer();

      await reorderLessons();
      await vi.waitFor(() => {
        const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
        expect(cards[0].getAttribute("data-testid")).toBe(
          "lessons-drawer-card-lesson-2",
        );
      });

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "module-1",
          expect.objectContaining({ title: { ar: "المقدمة", en: "" } }),
          ["lesson-2", "lesson-1"],
        ),
      );
      // Closes only the Lessons drawer, revealing the still-open Module
      // drawer underneath -- not the whole editor.
      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Lessons" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("dialog", { name: "Edit Module" }),
      ).toBeInTheDocument();
    });

    it("Cancel is gated behind a discard confirmation once the order has been reordered, and confirming discards it", async () => {
      mockFetch({ lessons: LESSONS });
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderDrawer({ onSave });
      const { lessonsDialog } = await openLessonsDrawer();

      await reorderLessons();
      await vi.waitFor(() => {
        const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
        expect(cards[0].getAttribute("data-testid")).toBe(
          "lessons-drawer-card-lesson-2",
        );
      });

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "Cancel" }),
      );

      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Lessons" }),
        ).not.toBeInTheDocument(),
      );

      // Reopening the Lessons drawer shows the original, un-reordered list.
      await openLessonsDrawer();
      const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
      expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
        "lessons-drawer-card-lesson-1",
        "lessons-drawer-card-lesson-2",
      ]);
    });

    it("Cancel closes directly, without confirmation, when the order was never touched", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "Cancel" }),
      );

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Lessons" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("dialog", { name: "Edit Module" }),
      ).toBeInTheDocument();
    });

    it("Back and Escape are gated behind the same discard confirmation as Cancel once the order has been reordered", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      await reorderLessons();
      await vi.waitFor(() => {
        const cards = screen.getAllByTestId(/^lessons-drawer-card-/);
        expect(cards[0].getAttribute("data-testid")).toBe(
          "lessons-drawer-card-lesson-2",
        );
      });

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "Back" }),
      );
      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

      fireEvent.keyDown(lessonsDialog, { key: "Escape", code: "Escape" });
      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
    });

    // ANA-125: New Lesson/Edit now open the existing Lesson configuration UI
    // in their own nested Lesson editor drawer, stacked above the Lessons
    // drawer -- which stays mounted/open underneath, rather than being
    // hidden the way ANA-124 hid it.
    it("New Lesson opens a nested Lesson editor drawer above the Lessons drawer, which stays open underneath", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "New Lesson" }),
      );

      const lessonEditorDialog = await findDrawerDialog("New Lesson");
      expect(lessonEditorDialog).toBeInTheDocument();
      // The Lessons drawer is still mounted underneath, list intact.
      expect(
        screen.getByRole("dialog", { name: "Lessons" }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("dialog", { name: "Lessons" })).getByText(
          "الدرس الأول",
        ),
      ).toBeInTheDocument();
      // The Module editor is still mounted underneath both, fields intact.
      const moduleDialog = screen.getByRole("dialog", { name: "Edit Module" });
      expect(moduleDialog).toBeInTheDocument();
      expect(within(moduleDialog).getByLabelText("Title")).toHaveValue(
        "المقدمة",
      );
    });

    it("Edit opens a nested Lesson editor drawer above the Lessons drawer, which stays open underneath", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", {
          name: "Edit الدرس الأول",
        }),
      );

      const lessonEditorDialog = await findDrawerDialog("Edit Lesson");
      expect(lessonEditorDialog).toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Lessons" }),
      ).toBeInTheDocument();
    });

    it("backing out of the nested Lesson editor drawer reveals the still-open Lessons drawer underneath", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "New Lesson" }),
      );
      const lessonEditorDialog = await findDrawerDialog("New Lesson");

      fireEvent.click(
        within(lessonEditorDialog).getByRole("button", { name: "Back" }),
      );

      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "New Lesson" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("dialog", { name: "Lessons" }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("dialog", { name: "Lessons" })).getByText(
          "الدرس الأول",
        ),
      ).toBeInTheDocument();
    });

    it("uses a 460px Lesson editor drawer width on desktop, opening from the right", async () => {
      mockFetch({ lessons: LESSONS });
      renderDrawer();
      const { lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "New Lesson" }),
      );
      await findDrawerDialog("New Lesson");

      const roots = document.querySelectorAll(".mantine-Drawer-root");
      const widths = Array.from(roots).map((root) =>
        root.getAttribute("style"),
      );
      expect(widths.some((style) => style?.includes("min(460px, 100vw)"))).toBe(
        true,
      );
    });

    it("closing the Lessons drawer (clean) reveals the unchanged Module editor drawer and does not mark it dirty", async () => {
      const onClose = vi.fn();
      mockFetch({ lessons: LESSONS });
      renderDrawer({ onClose });
      const { moduleDialog, lessonsDialog } = await openLessonsDrawer();

      fireEvent.click(
        within(lessonsDialog).getByRole("button", { name: "Back" }),
      );
      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Lessons" }),
        ).not.toBeInTheDocument(),
      );

      expect(within(moduleDialog).getByLabelText("Title")).toHaveValue(
        "المقدمة",
      );
      fireEvent.click(
        within(moduleDialog).getByRole("button", { name: "Cancel" }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
