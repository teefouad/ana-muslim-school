import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleModal,
  type EditModuleModalProps,
} from "./edit-module-modal";
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
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).not.toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      });
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

      resolveTranslate(jsonResponse({ data: { text: "Description" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      });
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

      resolveTranslate(jsonResponse({ data: { text: "Content" } }));

      await vi.waitFor(() => {
        expect(getContentEditable(dialog)).toHaveAttribute(
          "contenteditable",
          "true",
        );
      });
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
