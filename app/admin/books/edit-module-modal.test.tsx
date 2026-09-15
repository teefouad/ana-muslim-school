import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleModal,
  type EditModuleModalProps,
} from "./edit-module-modal";
import { buildLessonFixture } from "./lesson-fixtures";
import { createEmptyModuleFieldsValues } from "./module-fields";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { Book } from "@/lib/books/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Selects the first `length` characters of the editor's first text node
// directly through the native Selection API -- ported from form-field.test.tsx
// (see that file's identical helper for why jsdom needs this instead of
// simulated cursor movement).
function selectFirstCharacters(root: HTMLElement, length: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function lastRequestBody(): Record<string, unknown> {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

// Title and Description are plain text inputs (also role "textbox"); the
// Content field's own contenteditable Markdown editor -- the only one with
// a `contenteditable` attribute -- renders last (see the existing selection
// test below for the identical convention).
function getContentEditable(dialog: HTMLElement): HTMLElement {
  const textboxes = within(dialog).getAllByRole("textbox");
  return textboxes[textboxes.length - 1];
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
};

function renderModal(overrides: Partial<EditModuleModalProps> = {}) {
  return render(
    <MantineProvider>
      <EditModuleModal
        state={{ mode: "edit", id: "module-1", fields: EDIT_FIELDS }}
        book={BOOK}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCreateLesson={vi.fn().mockResolvedValue(undefined)}
        onUpdateLesson={vi.fn().mockResolvedValue(undefined)}
        onDeleteLesson={vi.fn().mockResolvedValue(undefined)}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("EditModuleModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders nothing when state is null", () => {
    renderModal({ state: null });

    expect(
      screen.queryByRole("dialog", { name: "Edit Module" }),
    ).not.toBeInTheDocument();
  });

  describe("create mode (ANA-94)", () => {
    it("opens titled 'Add Module' with every field blank, primary action 'Save Module'", async () => {
      renderModal({ state: { mode: "create" } });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).toHaveValue(DEFAULT_APPLICATION_COLOR);
      expect(
        within(dialog).getByRole("button", { name: "Save Module" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument();
    });

    it("calls onCreate with the entered fields, then onClose, once creation succeeds", async () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ state: { mode: "create" }, onCreate, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "وحدة جديدة" },
      });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Pink" }));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Module" }),
      );

      await vi.waitFor(() => expect(onCreate).toHaveBeenCalled());
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.objectContaining({ ar: "وحدة جديدة" }),
          color: "pink.6",
        }),
      );
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("keeps the modal open and shows the error when creation fails, without calling onClose", async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error("Book not found."));
      const onClose = vi.fn();
      renderModal({ state: { mode: "create" }, onCreate, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Module" }),
      );

      expect(
        await within(dialog).findByText("Book not found."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("edit mode", () => {
    it("opens titled 'Edit Module', seeded with Title, Description, Color, and Content", async () => {
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");
      expect(within(dialog).getByLabelText("Description")).toHaveValue("وصف");
      expect(await within(dialog).findByText("محتوى")).toBeInTheDocument();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).toHaveValue("cyan.6");
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeInTheDocument();
    });

    it("calls onSave with the module id and edited fields, then onClose, once saving succeeds", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
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
        ),
      );
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("keeps the modal open and shows the error when saving fails, without calling onClose", async () => {
      const onSave = vi.fn().mockRejectedValue(new Error("Module not found."));
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        await within(dialog).findByText("Module not found."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose without onCreate/onSave when Cancel is clicked", async () => {
      const onCreate = vi.fn();
      const onSave = vi.fn();
      const onClose = vi.fn();
      renderModal({ onCreate, onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("seeds a brand-new Module's fields (createEmptyModuleFieldsValues) with blanks", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-new",
          fields: createEmptyModuleFieldsValues(),
        },
      });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
    });
  });

  describe("modal width (ANA-115 PR review)", () => {
    function modalSizeStyle(): string {
      const root = document.querySelector(".mantine-Modal-root");
      return root?.getAttribute("style") ?? "";
    }

    it("uses a 900px modal width in Module mode", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-1",
          fields: EDIT_FIELDS,
          lessons: [buildLessonFixture({ id: "lesson-1" })],
        },
      });

      await screen.findByRole("dialog", { name: "Edit Module" });
      expect(modalSizeStyle()).toContain("min(900px, calc(100vw - 48px))");
    });

    it("keeps the same 900px modal width in Lesson mode -- the modal never grows when switching modes", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-1",
          fields: EDIT_FIELDS,
          lessons: [
            buildLessonFixture({ id: "lesson-1", title: { ar: "أ", en: "" } }),
          ],
        },
      });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Edit أ" }));

      await within(dialog).findByTestId("lesson-form");
      expect(modalSizeStyle()).toContain("min(900px, calc(100vw - 48px))");
    });

    it("does not use the modal's own default width in create mode", async () => {
      renderModal({ state: { mode: "create" } });

      await screen.findByRole("dialog", { name: "Add Module" });
      expect(modalSizeStyle()).not.toContain("900px");
    });
  });

  describe("Module mode Lessons list (ANA-111/ANA-115)", () => {
    const LESSONS = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "Introduction", en: "" },
      }),
      buildLessonFixture({
        id: "lesson-2",
        title: { ar: "Prayer basics", en: "" },
        type: "video",
        position: 1,
        isPublished: true,
      }),
    ];

    function renderWithLessons(overrides: Partial<EditModuleModalProps> = {}) {
      return renderModal({
        state: {
          mode: "edit",
          id: "module-1",
          fields: EDIT_FIELDS,
          lessons: LESSONS,
        },
        ...overrides,
      });
    }

    it("shows the Module editor and Lessons list together (never a third, simultaneous Lesson editor)", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toBeInTheDocument();
      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(within(dialog).getByText("Introduction")).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Back to Module" }),
      ).not.toBeInTheDocument();
    });

    it("does not render the Lessons list in create mode", async () => {
      renderModal({ state: { mode: "create" } });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      expect(within(dialog).queryByText("Lessons")).not.toBeInTheDocument();
    });

    it("renders Lessons in the provided order", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const rows = within(dialog).getAllByTestId(/^list-item-/);
      expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
        "list-item-lesson-1",
        "list-item-lesson-2",
      ]);
    });

    it("shows the Lessons empty state and no rows when no lessons are provided", async () => {
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByText("This module has no lessons yet."),
      ).toBeInTheDocument();
    });

    it("exposes Edit and Delete actions on every row, matching the Modules list pattern", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("button", { name: "Edit Introduction" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      ).toBeInTheDocument();
    });

    it("a single click on a Lesson row no longer opens its form (Edit is the only entry point)", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(within(dialog).getByText("Introduction"));

      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
    });

    it("reorders Lessons locally via the Lessons list, without a network request", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const grip = within(dialog)
        .getByTestId("list-item-lesson-2")
        .querySelector("[aria-hidden='true']") as HTMLElement;

      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });

      // Escaping a keyboard drag cancels it without reordering -- this only
      // confirms drag activation is wired through, and that neither
      // activating nor cancelling it ever calls the backend.
      expect(fetch).not.toHaveBeenCalled();
    });

    it("New Lesson switches into Lesson mode with a blank, id-less draft and makes no create request (ANA-115 PR review)", async () => {
      const onCreateLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onCreateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );

      expect(within(dialog).getByTestId("lesson-form")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
      expect(onCreateLesson).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("backing out of New Lesson without saving makes no create request and returns to the Lessons list", async () => {
      const onCreateLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onCreateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(onCreateLesson).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("Saving a New Lesson calls onCreateLesson exactly once and returns to Module mode", async () => {
      const onCreateLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onCreateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "New lesson title" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() => expect(onCreateLesson).toHaveBeenCalledTimes(1));
      expect(onCreateLesson).toHaveBeenCalledWith(
        expect.objectContaining({ title: { ar: "New lesson title" } }),
      );
      await vi.waitFor(() =>
        expect(within(dialog).getByText("Lessons")).toBeInTheDocument(),
      );
    });

    it("calls onDeleteLesson once Delete is confirmed", async () => {
      const onDeleteLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onDeleteLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      );
      // The delete confirmation is a separate Modal, not nested inside the
      // Edit Module dialog's own DOM subtree -- unscoped, matching
      // lessons-panel.test.tsx's identical interaction.
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      await vi.waitFor(() =>
        expect(onDeleteLesson).toHaveBeenCalledWith(LESSONS[0]),
      );
    });

    it("keeps the row and shows an error when Delete Lesson fails", async () => {
      const onDeleteLesson = vi
        .fn()
        .mockRejectedValue(new Error("Lesson not found."));
      renderWithLessons({ onDeleteLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      expect(
        await within(dialog).findByText("Lesson not found."),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Introduction")).toBeInTheDocument();
    });
  });

  describe("Lesson mode (ANA-115)", () => {
    const LESSONS = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "Introduction", en: "" },
        description: { ar: "Short intro", en: "" },
      }),
      buildLessonFixture({
        id: "lesson-2",
        title: { ar: "Prayer basics", en: "" },
        type: "video",
        position: 3,
        isPublished: true,
      }),
    ];

    function renderWithLessons(overrides: Partial<EditModuleModalProps> = {}) {
      return renderModal({
        state: {
          mode: "edit",
          id: "module-1",
          fields: EDIT_FIELDS,
          lessons: LESSONS,
        },
        ...overrides,
      });
    }

    async function openLesson(dialog: HTMLElement, label: string) {
      fireEvent.click(
        within(dialog).getByRole("button", { name: `Edit ${label}` }),
      );
      return within(dialog).getByTestId("lesson-form");
    }

    it("switches from Module mode to Lesson mode when Edit is clicked, replacing the Module editor/Lessons list entirely", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await openLesson(dialog, "Introduction");

      expect(within(dialog).queryByText("Lessons")).not.toBeInTheDocument();
      // The Module form's own "Description" field is gone -- only the
      // Lesson's own "One-line description" remains.
      expect(
        within(dialog).queryByLabelText("Description"),
      ).not.toBeInTheDocument();
      expect(
        within(dialog).getByLabelText("One-line description"),
      ).toBeInTheDocument();
      // Only the Lesson's own "Title" input remains -- the Module form's own
      // Title field is gone, not layered behind/alongside it.
      expect(within(dialog).getAllByLabelText("Title")).toHaveLength(1);
      expect(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      ).toBeInTheDocument();
    });

    it("seeds the Lesson editor from the clicked Lesson's fields", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      expect(form.getByDisplayValue("Introduction")).toBeInTheDocument();
      expect(form.getByDisplayValue("Short intro")).toBeInTheDocument();
      expect(form.getByRole("switch", { name: "Published" })).not.toBeChecked();
      expect(
        form.getByRole("radio", { name: "0", checked: true }),
      ).toBeInTheDocument();
    });

    it("Back to Module returns to Module mode without closing the modal", async () => {
      const onClose = vi.fn();
      renderWithLessons({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await openLesson(dialog, "Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("preserves an unsaved Module field edit across entering and leaving Lesson mode", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "Module title, edited" },
      });

      await openLesson(dialog, "Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(
        within(dialog).getByDisplayValue("Module title, edited"),
      ).toBeInTheDocument();
    });

    it("editing one Lesson never leaks into another's fields", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      let form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );
      // The discard confirmation is a separate Modal, not nested inside the
      // Edit Module dialog's own DOM subtree -- unscoped, matching
      // lesson-editor.test.tsx's identical interaction.
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      form = within(await openLesson(dialog, "Prayer basics"));
      expect(
        form.queryByDisplayValue("Introduction, edited"),
      ).not.toBeInTheDocument();
      expect(form.getByDisplayValue("Prayer basics")).toBeInTheDocument();
    });

    it("Save changes sends only this Lesson's fields through onUpdateLesson (not onCreateLesson), no Module fields", async () => {
      const onCreateLesson = vi.fn().mockResolvedValue(undefined);
      const onUpdateLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onCreateLesson, onUpdateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(onUpdateLesson).toHaveBeenCalledWith(
          "lesson-1",
          expect.objectContaining({
            title: { ar: "Introduction, edited", en: "" },
            description: { ar: "Short intro", en: "" },
            type: "text",
            position: 0,
            isPublished: false,
          }),
        ),
      );
      expect(onCreateLesson).not.toHaveBeenCalled();
    });

    it("returns to Module mode once Lesson Save succeeds", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await openLesson(dialog, "Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(within(dialog).getByText("Lessons")).toBeInTheDocument(),
      );
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
    });

    it("stays in Lesson mode and preserves the draft when Lesson Save fails", async () => {
      const onUpdateLesson = vi
        .fn()
        .mockRejectedValue(new Error("Lesson not found."));
      renderWithLessons({ onUpdateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        await within(dialog).findByText("Lesson not found."),
      ).toBeInTheDocument();
      expect(
        form.getByDisplayValue("Introduction, edited"),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText("Lessons")).not.toBeInTheDocument();
    });

    it("translates Title through the plain translation endpoint only, never a Lesson persistence request", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Translated" } }),
      );
      const onUpdateLesson = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onUpdateLesson });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      fireEvent.click(
        form.getByRole("button", { name: "Translate Title with AI" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/translate",
        expect.objectContaining({ method: "POST" }),
      );
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      // The plain, context-free translation body -- no `field`/`bookId`
      // Module-scoped context, unlike Module Title's own translate request.
      expect(body).toEqual({ text: "Introduction" });
      expect(onUpdateLesson).not.toHaveBeenCalled();
    });
  });

  describe("AI busy is scoped to the active field (ANA-109)", () => {
    it("disables only Title while its Translate request is running, and re-enables it once it resolves", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).toBeDisabled();
      });
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      expect(getContentEditable(dialog)).toHaveAttribute(
        "contenteditable",
        "true",
      );
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
      expect(
        within(dialog).getByRole("radiogroup", { name: "Color" }),
      ).not.toHaveAttribute("aria-disabled", "true");
      // Save stays disabled while Title's own translation is unresolved --
      // unlike Description/Content/Color, it isn't "a field this AI request
      // has nothing to do with": saving now would persist Title's
      // pre-translation value, and the AI result would be lost once it
      // resolves after this component has already unmounted (PR review).
      // Cancel is unaffected -- discarding the draft is always safe.
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).not.toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("disables only Description while its Translate request is running", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Description with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Description")).toBeDisabled();
      });
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(getContentEditable(dialog)).toHaveAttribute(
        "contenteditable",
        "true",
      );
      // Save is still gated on Description's own in-flight request, even
      // though Description itself is the only field disabled.
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Description" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("disables only Content while its Translate request is running", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(getContentEditable(dialog)).toHaveAttribute(
          "contenteditable",
          "false",
        );
      });
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Content" } }));

      await vi.waitFor(() => {
        expect(getContentEditable(dialog)).toHaveAttribute(
          "contenteditable",
          "true",
        );
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("does not persist the pre-translation value when Save is clicked while Translate is still in flight (PR review regression)", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).toBeDisabled();
      });

      // A disabled native button ignores clicks -- Save must not have
      // persisted the still-untranslated Title while its own AI result was
      // unresolved.
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));
      await vi.waitFor(() => {
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).not.toBeDisabled();
      });

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );
      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "module-1",
          expect.objectContaining({
            title: expect.objectContaining({ en: "Introduction" }),
          }),
        ),
      );
    });

    it("re-enables Title even when its Translate request fails, leaving other fields untouched throughout", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: "Something went wrong." }, 500),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await within(dialog).findByText("Something went wrong.");
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
    });

    it("re-enables Title even when its AI Assistance request fails", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ error: "Something went wrong." }, 500),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Title",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await within(dialog).findByText("Something went wrong.");
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
    });
  });

  describe("AI Assistance opens Additional Instructions; Translate with AI runs directly (ANA-98)", () => {
    it("never calls fetch until Generate is clicked, for AI Assistance", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Result" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });

      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Title",
        }),
      );
      await screen.findByRole("dialog", { name: "AI Assistance" });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls fetch immediately for Translate with AI, without ever showing Additional Instructions", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Result" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });

      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(
        screen.queryByRole("dialog", { name: "Translate with AI" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Module Title AI context (ANA-98)", () => {
    it("sends Module Content plus Book title/description/longDescription for AI Assistance", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Suggested title" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/assist",
        expect.objectContaining({ method: "POST" }),
      );
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "title",
        text: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("sends Module Content for Translate with AI", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Introduction" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "title",
        text: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("applies the AI Assistance result to the active Title language", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Suggested title" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByDisplayValue("Suggested title"),
      ).toBeInTheDocument();
    });
  });

  describe("Module Description AI context (ANA-98)", () => {
    it("sends Module Title, Module Content, and Book context for AI Assistance", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف محسّن" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Description",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "description",
        text: "وصف",
        moduleTitle: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("sends Module Title and Module Content for Translate with AI", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Description" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Description with AI",
        }),
      );
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "description",
        text: "وصف",
        moduleTitle: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("applies the AI Assistance result to the active Description language", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف محسّن" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Description",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByDisplayValue("وصف محسّن"),
      ).toBeInTheDocument();
    });
  });

  describe("Module Content AI context (ANA-98)", () => {
    it("exposes both AI Assistance and Translate with AI (previously missing)", async () => {
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      ).toBeInTheDocument();
    });

    it("sends Module Title, Module Description, and Book context for AI Assistance", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "محتوى محسّن" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      // assistLearningMaterial (the existing ANA-85 client fn, reused here
      // unchanged for backward compatibility -- see ai-assist-client.ts)
      // never sends an explicit `field` key; the server treats an omitted
      // `field` as `"content"`, its default.
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        text: "محتوى",
        moduleTitle: "المقدمة",
        moduleDescription: "وصف",
      });
      expect(lastRequestBody()).not.toHaveProperty("field");
      // No selection was made, so `text` already is the whole field --
      // fullMaterial is omitted rather than duplicating it (ANA-99).
      expect(lastRequestBody()).not.toHaveProperty("fullMaterial");
    });

    it("sends the full Content field as fullMaterial context, separate from the selected target, when AI Assistance runs on a Markdown selection (ANA-99)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "جزء محسّن" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      // Title and Description are plain text inputs (also role "textbox");
      // the Content field's own contenteditable Markdown editor -- the
      // only one with a non-empty selection to make -- renders last.
      const textboxes = within(dialog).getAllByRole("textbox");
      const editable = textboxes[textboxes.length - 1];
      await userEvent.setup().click(editable);
      selectFirstCharacters(editable, 3);

      const assistButton = within(dialog).getByRole("button", {
        name: "AI Assistance for Content",
      });

      // The editor's own Lexical selection syncs from the native DOM
      // selection asynchronously (see form-field.test.tsx's identical
      // retry) -- retry the click until the dialog reflects a captured
      // selection, cancelling in between so no stray dialog is left open.
      await vi.waitFor(() => {
        fireEvent.click(assistButton);
        const suggestDialog = screen.getByRole("dialog", {
          name: "AI Assistance",
        });
        if (!suggestDialog.textContent?.includes("text you selected")) {
          fireEvent.click(
            within(suggestDialog).getByRole("button", { name: "Cancel" }),
          );
          throw new Error("selection not yet synced");
        }
      });

      const suggestDialog = screen.getByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        fullMaterial: "محتوى",
      });
      expect(lastRequestBody().text).not.toBe("محتوى");
    });

    it("sends Module Title and Module Description for Translate with AI", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Content" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      );
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "content",
        text: "محتوى",
        moduleTitle: "المقدمة",
        moduleDescription: "وصف",
      });
    });

    it("applies the AI Assistance result to the active Content language", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "محتوى محسّن" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByText("محتوى محسّن"),
      ).toBeInTheDocument();
    });
  });

  describe("Additional Instructions (ANA-98)", () => {
    it("includes the trimmed Additional Instructions text in the AI Assistance request", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Suggested title" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.change(
        within(suggestDialog).getByLabelText(
          "Additional instructions or context (optional)",
        ),
        { target: { value: "Keep it short" } },
      );
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        additionalInstructions: "Keep it short",
      });
    });

    it("never opens Additional Instructions for Translate with AI, and never sends additionalInstructions", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "Introduction" } }),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(
        screen.queryByRole("dialog", { name: "Translate with AI" }),
      ).not.toBeInTheDocument();
      expect(lastRequestBody()).not.toHaveProperty("additionalInstructions");
    });
  });
});
