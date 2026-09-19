import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("EditModuleDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockFetch();
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

  it("clicking Lessons opens an empty nested drawer above the Module editor, which stays mounted underneath it", async () => {
    renderDrawer();
    const moduleDialog = await findDrawerDialog("Edit Module");

    fireEvent.click(
      within(moduleDialog).getByRole("button", { name: "Lessons" }),
    );

    const lessonsDialog = await findDrawerDialog("Lessons");
    expect(lessonsDialog).toBeInTheDocument();
    // The Module editor is still mounted underneath, fields intact.
    expect(
      screen.getByRole("dialog", { name: "Edit Module" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("المقدمة");
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
});
