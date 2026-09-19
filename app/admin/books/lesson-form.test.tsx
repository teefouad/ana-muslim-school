import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  content: {},
  videoURL: "",
  duration: 0,
  azkar: [],
  questions: [],
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
        moduleQuestions={[]}
        previousModuleQuestions={[]}
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

  describe("two-column layout (ANA-119)", () => {
    it("renders Title -> Description -> Published -> Position in the left column", () => {
      renderForm();

      const form = screen.getByTestId("lesson-form");
      expect(
        screen.getByRole("radiogroup", { name: "Position" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Description")).toBeInTheDocument();
      expect(
        screen.getByRole("switch", { name: "Published" }),
      ).toBeInTheDocument();

      const text = form.textContent ?? "";
      expect(text.indexOf("Title")).toBeLessThan(text.indexOf("Description"));
      expect(text.indexOf("Description")).toBeLessThan(
        text.indexOf("Published"),
      );
      expect(text.indexOf("Published")).toBeLessThan(text.indexOf("Position"));
    });

    it("renders Type -> the selected type's Configuration in the right column", () => {
      renderForm({ value: { ...VALUE, type: "video" } });

      const form = screen.getByTestId("lesson-form");
      expect(
        screen.getByRole("radiogroup", { name: "Type" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Video URL")).toBeInTheDocument();

      const text = form.textContent ?? "";
      expect(text.indexOf("Type")).toBeLessThan(text.indexOf("Video URL"));
    });

    it("puts Type/Configuration in a different column than Position/Title/Description/Published", () => {
      renderForm();

      const form = screen.getByTestId("lesson-form");
      const [leftColumn, rightColumn] = Array.from(form.children);
      expect(leftColumn.textContent).toContain("Position");
      expect(leftColumn.textContent).toContain("Title");
      expect(leftColumn.textContent).not.toContain("Type");
      expect(rightColumn.textContent).toContain("Type");
      expect(rightColumn.textContent).not.toContain("Position");
    });

    it("stacks to a single column below its own 640px container width, splitting into two equal columns above it (ANA-121)", () => {
      const { container } = renderForm();

      const combinedCss = Array.from(
        container.querySelectorAll("style[data-mantine-styles]"),
      )
        .map((style) => style.textContent ?? "")
        .join("\n");

      // Mantine's SimpleGrid (`type="container"`, `cols={{ base: 1, "640px":
      // 2 }}`, ANA-121) sets `--sg-cols` unconditionally to 1, then
      // overrides it to 2 only inside an `@container` query keyed to this
      // grid's own rendered width, not the viewport's -- see this form's own
      // top-level `SimpleGrid` doc comment for why that distinction matters
      // once this form can render inside the narrow Edit Module drawer, not
      // just the wide modal.
      expect(combinedCss).toContain("--sg-cols:1");
      expect(combinedCss).toMatch(
        /@container simple-grid \(min-width: 640px\)[^{]*\{[^}]*--sg-cols:2/,
      );
    });
  });

  it("seeds every field from the given value", () => {
    renderForm({
      value: { ...VALUE, type: "video", isPublished: true, position: 4 },
    });

    expect(
      screen.getByRole("radio", { name: "Video", checked: true }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("المقدمة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Published" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "4", checked: true }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the updated Type, leaving other fields untouched", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "Video" }));

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

  it("calls onChange with the updated Description", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "وصف جديد" },
    });

    expect(onChange).toHaveBeenCalledWith({
      description: { ar: "وصف جديد", en: "" },
    });
  });

  describe("type-specific Configuration (ANA-118)", () => {
    // Title/Description are plain text inputs (also role "textbox"); the
    // Content field's own contenteditable Markdown editor -- the only one
    // with a `contenteditable` attribute -- renders last, matching
    // edit-module-modal.test.tsx's identical convention for Module Content.
    function getContentEditable(): HTMLElement {
      const textboxes = screen.getAllByRole("textbox");
      return textboxes[textboxes.length - 1];
    }

    it("shows Text's translatable Markdown Content field and emits edits as Markdown", async () => {
      const user = userEvent.setup();
      const { onChange } = renderForm({
        value: { ...VALUE, type: "text", content: { ar: "مرحبا", en: "" } },
      });

      expect(screen.getByText("Content")).toBeInTheDocument();

      const editable = getContentEditable();
      await user.click(editable);
      await user.type(editable, "!");

      await vi.waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith({
          content: { ar: "مرحبا!", en: "" },
        }),
      );
    });

    it("seeds Text's Content field from the given value", async () => {
      renderForm({
        value: {
          ...VALUE,
          type: "text",
          content: { ar: "مرحبا بالعالم", en: "" },
        },
      });

      expect(await screen.findByText("مرحبا بالعالم")).toBeInTheDocument();
    });

    it("shows Video's Video URL and Duration fields, calling onChange with each", () => {
      const { onChange } = renderForm({
        value: { ...VALUE, type: "video" },
      });

      fireEvent.change(screen.getByLabelText("Video URL"), {
        target: { value: "https://example.com/video.mp4" },
      });
      expect(onChange).toHaveBeenCalledWith({
        videoURL: "https://example.com/video.mp4",
      });

      fireEvent.change(screen.getByLabelText("Duration"), {
        target: { value: "90" },
      });
      expect(onChange).toHaveBeenCalledWith({ duration: 90 });
    });

    it("seeds Video's Video URL and Duration from the given value", () => {
      renderForm({
        value: {
          ...VALUE,
          type: "video",
          videoURL: "https://example.com/video.mp4",
          duration: 120,
        },
      });

      expect(
        screen.getByDisplayValue("https://example.com/video.mp4"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("120")).toBeInTheDocument();
    });

    it("shows Break's sortable Break entries configuration, calling onChange with the updated azkar", () => {
      const { onChange } = renderForm({
        value: {
          ...VALUE,
          type: "break",
          azkar: [
            { id: "entry-1", text: { ar: "سبحان الله", en: "" }, repeat: 1 },
          ],
        },
      });

      expect(screen.getByDisplayValue("سبحان الله")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
      expect(onChange).toHaveBeenCalledWith({
        azkar: [
          { id: "entry-1", text: { ar: "سبحان الله", en: "" }, repeat: 1 },
          expect.objectContaining({ text: { ar: "", en: "" }, repeat: 1 }),
        ],
      });
    });

    it.each(["quiz", "final", "skip"] as const)(
      "shows the Questions editor (and no Text/Video/Break configuration) for the %s type",
      (type) => {
        renderForm({ value: { ...VALUE, type } });

        expect(screen.getByText("Questions")).toBeInTheDocument();
        expect(screen.getByText("No questions yet.")).toBeInTheDocument();
        expect(screen.queryByText("Content")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Video URL")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Duration")).not.toBeInTheDocument();
        expect(screen.queryByText(/break entries/i)).not.toBeInTheDocument();
      },
    );

    it.each(["text", "video", "break"] as const)(
      "does not show the Questions editor for the %s type",
      (type) => {
        renderForm({ value: { ...VALUE, type } });

        expect(screen.queryByText("Questions")).not.toBeInTheDocument();
      },
    );
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

  it("reports Description's own Translate busy state through onDescriptionBusyChange", async () => {
    let resolveTranslate: (value: Response) => void = () => {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (resolveTranslate = resolve)),
    );
    const onDescriptionBusyChange = vi.fn();
    renderForm({ onDescriptionBusyChange });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Translate Description with AI",
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

    it("exposes AI Assistance for both Title and Description", () => {
      renderForm();

      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "AI Assistance for Description",
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

    it("sends the current Module Title/Description/Content as context for Description's AI Assistance, applying the result to Description only", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "وصف مقترح" } }),
      );
      const { onChange } = renderForm();

      fireEvent.click(
        screen.getByRole("button", {
          name: "AI Assistance for Description",
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

    it("writes Description's Suggest result to Arabic even when the English tab is active, without touching English (ANA-116 PR review)", async () => {
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
          name: "AI Assistance for Description",
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
