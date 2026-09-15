import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonForm, type LessonFormProps } from "./lesson-form";
import type { LessonFieldsValues } from "./lesson-fields";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALUE: LessonFieldsValues = {
  title: { ar: "المقدمة", en: "" },
  description: { ar: "وصف قصير", en: "" },
  type: "text",
  position: 2,
  isPublished: false,
};

function renderForm(overrides: Partial<LessonFormProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MantineProvider>
      <LessonForm
        value={VALUE}
        onChange={onChange}
        moduleTitle="عنوان الوحدة"
        moduleDescription="وصف الوحدة"
        moduleContent="محتوى الوحدة"
        {...overrides}
      />
    </MantineProvider>,
  );
  return { onChange, ...utils };
}

describe("LessonForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders exactly Type, Title, One-line description, Published, and Position -- no Configuration", () => {
    renderForm();

    expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("One-line description")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Position" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/config/i)).not.toBeInTheDocument();
  });

  it("seeds every field from the given value", () => {
    renderForm({
      value: { ...VALUE, type: "video", isPublished: true, position: 4 },
    });

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Video");
    expect(screen.getByDisplayValue("المقدمة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Published" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "4", checked: true }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the updated Type, leaving other fields untouched", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Video" }));

    expect(onChange).toHaveBeenCalledWith({ type: "video" });
  });

  it("calls onChange with the updated Title", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });

    expect(onChange).toHaveBeenCalledWith({
      title: { ar: "عنوان جديد", en: "" },
    });
  });

  it("calls onChange with the updated One-line description", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText("One-line description"), {
      target: { value: "وصف جديد" },
    });

    expect(onChange).toHaveBeenCalledWith({
      description: { ar: "وصف جديد", en: "" },
    });
  });

  it("calls onChange with Published toggled", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("switch", { name: "Published" }));

    expect(onChange).toHaveBeenCalledWith({ isPublished: true });
  });

  it("calls onChange with the selected Position", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "4" }));

    expect(onChange).toHaveBeenCalledWith({ position: 4 });
  });

  it("translates Title through the plain, context-free translation endpoint, applying the result to English", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ data: { text: "Introduction" } }),
    );
    const { onChange } = renderForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Translate Title with AI" }),
    );

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/ai/translate",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    // Plain and context-free -- no `field`/`bookId`, unlike Module Title's
    // own translate request (translateModuleField).
    expect(JSON.parse(init.body as string)).toEqual({ text: "المقدمة" });

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        title: { ar: "المقدمة", en: "Introduction" },
      }),
    );
  });

  it("reports Title's own Translate busy state through onTitleBusyChange", async () => {
    let resolveTranslate: (value: Response) => void = () => {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (resolveTranslate = resolve)),
    );
    const onTitleBusyChange = vi.fn();
    renderForm({ onTitleBusyChange });

    fireEvent.click(
      screen.getByRole("button", { name: "Translate Title with AI" }),
    );

    await vi.waitFor(() =>
      expect(onTitleBusyChange).toHaveBeenCalledWith(true),
    );

    resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

    await vi.waitFor(() =>
      expect(onTitleBusyChange).toHaveBeenCalledWith(false),
    );
  });

  it("reports One-line description's own Translate busy state through onDescriptionBusyChange", async () => {
    let resolveTranslate: (value: Response) => void = () => {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (resolveTranslate = resolve)),
    );
    const onDescriptionBusyChange = vi.fn();
    renderForm({ onDescriptionBusyChange });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Translate One-line description with AI",
      }),
    );

    await vi.waitFor(() =>
      expect(onDescriptionBusyChange).toHaveBeenCalledWith(true),
    );

    resolveTranslate(jsonResponse({ data: { text: "Short intro" } }));

    await vi.waitFor(() =>
      expect(onDescriptionBusyChange).toHaveBeenCalledWith(false),
    );
  });

  it("never issues a network request for a local, non-translation edit", () => {
    renderForm();

    fireEvent.click(screen.getByRole("switch", { name: "Published" }));
    fireEvent.click(screen.getByRole("radio", { name: "0" }));

    expect(fetch).not.toHaveBeenCalled();
  });

  describe("AI Assistance (ANA-116)", () => {
    function lastRequestBody(): Record<string, unknown> {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      const [, init] = calls[calls.length - 1] as [string, RequestInit];
      return JSON.parse(init.body as string) as Record<string, unknown>;
    }

    it("exposes AI Assistance for both Title and One-line description", () => {
      renderForm();

      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "AI Assistance for One-line description",
        }),
      ).toBeInTheDocument();
    });

    it("sends the current Module Title/Description/Content as context for Title's AI Assistance, applying the result to Title only", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "اقتراح" } }),
      );
      const { onChange } = renderForm();

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/assist",
        expect.objectContaining({ method: "POST" }),
      );
      expect(lastRequestBody()).toMatchObject({
        field: "lessonTitle",
        text: "المقدمة",
        moduleTitle: "عنوان الوحدة",
        moduleDescription: "وصف الوحدة",
        moduleContent: "محتوى الوحدة",
      });
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          title: { ar: "اقتراح", en: "" },
        }),
      );
    });

    it("sends the current Module Title/Description/Content as context for One-line description's AI Assistance, applying the result to Description only", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف مقترح" } }),
      );
      const { onChange } = renderForm();

      fireEvent.click(
        screen.getByRole("button", {
          name: "AI Assistance for One-line description",
        }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        field: "lessonDescription",
        text: "وصف قصير",
        moduleTitle: "عنوان الوحدة",
        moduleDescription: "وصف الوحدة",
        moduleContent: "محتوى الوحدة",
      });
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          description: { ar: "وصف مقترح", en: "" },
        }),
      );
    });

    it("writes Title's Suggest result to Arabic even when the English tab is active, without touching English (ANA-116 PR review)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "اقتراح" } }),
      );
      const { onChange } = renderForm();

      const titleSwitcher = screen.getAllByRole("radiogroup", {
        name: "Language",
      })[0];
      fireEvent.click(
        within(titleSwitcher).getByRole("radio", { name: "English" }),
      );

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      // Suggest always generates Arabic -- even sourced from and written to
      // `ar`, never the currently active `en` tab.
      expect(lastRequestBody()).toMatchObject({
        field: "lessonTitle",
        text: "المقدمة",
      });
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          title: { ar: "اقتراح", en: "" },
        }),
      );
      expect(onChange).not.toHaveBeenCalledWith({
        title: { ar: "المقدمة", en: "اقتراح" },
      });
    });

    it("writes One-line description's Suggest result to Arabic even when the English tab is active, without touching English (ANA-116 PR review)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف مقترح" } }),
      );
      const { onChange } = renderForm();

      const descriptionSwitcher = screen.getAllByRole("radiogroup", {
        name: "Language",
      })[1];
      fireEvent.click(
        within(descriptionSwitcher).getByRole("radio", { name: "English" }),
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "AI Assistance for One-line description",
        }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      expect(lastRequestBody()).toMatchObject({
        field: "lessonDescription",
        text: "وصف قصير",
      });
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          description: { ar: "وصف مقترح", en: "" },
        }),
      );
      expect(onChange).not.toHaveBeenCalledWith({
        description: { ar: "وصف قصير", en: "وصف مقترح" },
      });
    });

    it("reports Title's own AI Assistance busy state through onTitleBusyChange", async () => {
      let resolveAssist: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveAssist = resolve)),
      );
      const onTitleBusyChange = vi.fn();
      renderForm({ onTitleBusyChange });

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() =>
        expect(onTitleBusyChange).toHaveBeenCalledWith(true),
      );

      resolveAssist(jsonResponse({ data: { text: "اقتراح" } }));

      await vi.waitFor(() =>
        expect(onTitleBusyChange).toHaveBeenCalledWith(false),
      );
    });
  });
});
