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

// The custom "Edit Module" `<Title>` `ModuleEditorBody` renders (ANA-121:
// shared with the modal, see module-editor-body.tsx) is absolutely
// positioned over the Drawer's own header rather than passed through as
// Mantine's `title` prop -- so, same as the pre-existing Edit Module modal,
// the drawer's own `role="dialog"` element never gets an `aria-labelledby`
// Testing Library could match a `name` against. Locating it through the
// heading itself (a real `<h1>`, whose accessible name *does* come from its
// content) and walking up to its nearest `[role="dialog"]` ancestor sidesteps
// that gap instead of relying on it.
async function findDrawerDialog(name: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name });
  const dialog = heading.closest('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) {
    throw new Error(`Could not find a dialog ancestor for heading "${name}"`);
  }
  return dialog;
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

  it("uses a 500px drawer width on desktop, opening from the right", async () => {
    renderDrawer();
    await findDrawerDialog("Edit Module");

    const root = document.querySelector(".mantine-Drawer-root");
    expect(root?.getAttribute("style")).toContain("min(500px, 100vw)");
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

  it("still opens and edits Lessons from inside the drawer (ANA-116/ANA-121)", async () => {
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
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Edit الدرس الأول" }),
    );

    expect(
      await within(dialog).findByRole("heading", { name: "Edit Lesson" }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByTestId("lesson-form"),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Title")).toHaveValue("الدرس الأول");
  });
});
