import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleModal,
  type EditModuleModalProps,
} from "./edit-module-modal";
import { createEmptyModuleFieldsValues } from "./module-fields";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
        bookId="book-1"
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

  describe("AI busy disables the form (ANA-94)", () => {
    it("disables Title, Description, Color, and Content while Translate is running, and re-enables them once it resolves", async () => {
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
      expect(within(dialog).getByLabelText("Description")).toBeDisabled();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("radiogroup", { name: "Color" }),
      ).toHaveAttribute("aria-disabled", "true");

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      });
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
    });

    it("re-enables the form even when Translate fails", async () => {
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
    });
  });

  describe("AI actions (from ANA-91, now wired through the shared FormField, ANA-97)", () => {
    it("Translate title fills English from Arabic via /api/v1/ai/translate", async () => {
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

      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/api/v1/ai/translate",
          expect.objectContaining({ method: "POST" }),
        ),
      );

      const titleLanguageSwitcher = within(dialog).getAllByRole("radiogroup", {
        name: "Language",
      })[0];
      fireEvent.click(
        within(titleLanguageSwitcher).getByRole("radio", { name: "English" }),
      );

      expect(
        await within(dialog).findByDisplayValue("Introduction"),
      ).toBeInTheDocument();
    });

    it("AI Assistance rewrites the active Description language via /api/v1/ai/assist", async () => {
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
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/assist",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
