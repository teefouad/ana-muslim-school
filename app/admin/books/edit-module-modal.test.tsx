import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleModal,
  type EditModuleModalProps,
} from "./edit-module-modal";
import { createEmptyModuleFieldsValues } from "./module-fields";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderModal(overrides: Partial<EditModuleModalProps> = {}) {
  return render(
    <MantineProvider>
      <EditModuleModal
        module={{
          id: "module-1",
          title: { ar: "المقدمة", en: "" },
          description: { ar: "وصف", en: "" },
          color: "cyan.6",
          content: { ar: "محتوى", en: "" },
        }}
        bookId="book-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("EditModuleModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders nothing when module is null", () => {
    renderModal({ module: null });

    expect(
      screen.queryByRole("dialog", { name: "Edit Module" }),
    ).not.toBeInTheDocument();
  });

  it("opens with the title 'Edit Module', seeded with Title, Description, Color, and Content", async () => {
    renderModal();

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");
    expect(await within(dialog).findByText("وصف")).toBeInTheDocument();
    expect(await within(dialog).findByText("محتوى")).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Color" })).toHaveValue(
      "cyan.6",
    );
  });

  it("calls onSave with the edited fields when Save changes is clicked, making no network request", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Pink" }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      "module-1",
      expect.objectContaining({
        title: { ar: "عنوان جديد", en: "" },
        color: "pink.6",
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls onClose without onSave when Cancel is clicked", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Translate title fills English from Arabic via /api/v1/ai/translate", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Introduction" } }),
    );
    renderModal();

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Translate title to English",
      }),
    );

    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/translate",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    // Translate never switches which language tab is showing (matching
    // learning-material-module-card.tsx's own Translate) -- the Title field
    // stays on Arabic, so switch to English (the Title field's own
    // switcher, the first of the three -- Title/Description/Content each
    // have one) to see the result it filled in.
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

  it("confirms before replacing an already-filled English title translation", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Refreshed" } }),
    );
    renderModal({
      module: {
        id: "module-1",
        title: { ar: "المقدمة", en: "Existing" },
        description: {},
        color: "cyan.6",
        content: {},
      },
    });

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Translate title to English",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Replace English translation?" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Translate and replace" }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/translate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("AI Suggest rewrites the active Description language via /api/v1/ai/assist", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "وصف محسّن" } }),
    );
    renderModal();

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "AI Suggest description" }),
    );

    const suggestDialog = await screen.findByRole("dialog", {
      name: "AI Suggest",
    });
    fireEvent.click(
      within(suggestDialog).getByRole("button", { name: "Generate" }),
    );

    expect(await within(dialog).findByText("وصف محسّن")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/assist",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body).toMatchObject({
      bookId: "book-1",
      text: "وصف",
      language: "ar",
    });
  });

  it("seeds a brand-new Module (createEmptyModuleFieldsValues) with blank fields", async () => {
    renderModal({
      module: { id: "module-new", ...createEmptyModuleFieldsValues() },
    });

    const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("");
  });
});
