import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLessonFixture } from "./lesson-fixtures";
import { LessonEditor, type LessonEditorProps } from "./lesson-editor";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequestBody(): Record<string, unknown> {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

const LESSON = buildLessonFixture({
  id: "lesson-1",
  title: { ar: "المقدمة", en: "" },
  description: { ar: "وصف قصير", en: "" },
});

function renderEditor(overrides: Partial<LessonEditorProps> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();
  const utils = render(
    <MantineProvider>
      <LessonEditor
        lesson={LESSON}
        moduleTitle="عنوان الوحدة"
        moduleDescription="وصف الوحدة"
        moduleContent="محتوى الوحدة"
        onCreate={onCreate}
        onUpdate={onUpdate}
        onBack={onBack}
        {...overrides}
      />
    </MantineProvider>,
  );
  return { onCreate, onUpdate, onBack, ...utils };
}

describe("LessonEditor (ANA-115 UI, wired to the real backend in ANA-116)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a Back to Module control and the Lesson's fields, seeded from the given Lesson", () => {
    renderEditor();

    expect(
      screen.getByRole("button", { name: "Back to Module" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lesson-form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("المقدمة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
  });

  it("goes back immediately when there are no unsaved edits", () => {
    const { onBack } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Back to Module" }));

    expect(onBack).toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
  });

  it("confirms before discarding when a field has been edited, and stays open on Keep editing", () => {
    const { onBack } = renderEditor();

    fireEvent.click(screen.getByRole("switch", { name: "Published" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Module" }));

    const dialog = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    expect(onBack).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );

    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Published" })).toBeChecked();
  });

  it("goes back once Discard changes is confirmed", () => {
    const { onBack } = renderEditor();

    fireEvent.click(screen.getByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Module" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(onBack).toHaveBeenCalled();
  });

  describe("existing Lesson (update)", () => {
    it("calls onUpdate (not onCreate) with only this Lesson's id and fields, then returns to Module mode once it resolves", async () => {
      const { onCreate, onUpdate, onBack } = renderEditor();

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith("lesson-1", {
          title: { ar: "عنوان جديد", en: "" },
          description: { ar: "وصف قصير", en: "" },
          type: "text",
          position: 0,
          isPublished: false,
        }),
      );
      expect(onCreate).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
    });

    it("stays in Lesson mode, preserves the draft, and shows the error when onUpdate fails", async () => {
      const onUpdate = vi
        .fn()
        .mockRejectedValue(new Error("Lesson not found."));
      const { onBack } = renderEditor({ onUpdate });

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("عنوان جديد")).toBeInTheDocument();
    });
  });

  describe("New Lesson -- no id (create)", () => {
    function renderNewLessonEditor(overrides: Partial<LessonEditorProps> = {}) {
      return renderEditor({ lesson: null, ...overrides });
    }

    it("seeds every field blank/default", () => {
      renderNewLessonEditor();

      expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue(
        "Text",
      );
      expect(screen.getByLabelText("Title")).toHaveValue("");
      expect(
        screen.getByRole("switch", { name: "Published" }),
      ).not.toBeChecked();
      expect(
        screen.getByRole("radio", { name: "2", checked: true }),
      ).toBeInTheDocument();
    });

    it("goes back with no confirmation and no request when untouched (backing out leaves nothing added)", () => {
      const { onCreate, onBack } = renderNewLessonEditor();

      fireEvent.click(screen.getByRole("button", { name: "Back to Module" }));

      expect(onBack).toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
    });

    it("never calls onCreate merely by being rendered", () => {
      const { onCreate } = renderNewLessonEditor();

      expect(onCreate).not.toHaveBeenCalled();
    });

    it("calls onCreate (not onUpdate) exactly once and returns to Module mode once it resolves", async () => {
      const { onCreate, onUpdate, onBack } = renderNewLessonEditor();

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "مقدمة جديدة" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith({
          title: { ar: "مقدمة جديدة" },
          description: {},
          type: "text",
          position: 2,
          isPublished: false,
        }),
      );
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
    });

    it("stays in Lesson mode, preserves the draft, and shows the error when onCreate fails, without implicitly retrying", async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error("Book not found."));
      const { onBack } = renderNewLessonEditor({ onCreate });

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "مقدمة جديدة" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Book not found.")).toBeInTheDocument();
      expect(onBack).not.toHaveBeenCalled();
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue("مقدمة جديدة")).toBeInTheDocument();

      // A second Save click after the failure retries create, but only ever
      // as a fresh, explicit user action -- never automatically.
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(onCreate).toHaveBeenCalledTimes(2);
    });
  });

  it("disables Save while Title's own Translate request is unresolved", async () => {
    let resolveTranslate: (value: Response) => void = () => {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (resolveTranslate = resolve)),
    );
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "Translate Title with AI" }),
    );

    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeDisabled(),
    );

    resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled(),
    );
  });

  describe("AI Suggest for Title/Description (ANA-116)", () => {
    it("exposes both Translate and AI Assistance for Title and One-line description", () => {
      renderEditor();

      expect(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Translate One-line description with AI",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "AI Assistance for One-line description",
        }),
      ).toBeInTheDocument();
    });

    it("grounds Title's AI Assistance in the current Module context passed down from Edit Module", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "اقتراح" } }),
      );
      renderEditor({
        moduleTitle: "عنوان محدث",
        moduleDescription: "وصف محدث",
        moduleContent: "محتوى محدث",
      });

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(lastRequestBody()).toMatchObject({
        field: "lessonTitle",
        moduleTitle: "عنوان محدث",
        moduleDescription: "وصف محدث",
        moduleContent: "محتوى محدث",
      });
    });

    it("applies a Title suggestion only to Title, never Description", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ data: { text: "اقتراح للعنوان" } }),
      );
      renderEditor();

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      expect(
        await screen.findByDisplayValue("اقتراح للعنوان"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
    });

    it("keeps Save disabled while Title's AI Assistance request is unresolved", async () => {
      let resolveAssist: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveAssist = resolve)),
      );
      renderEditor();

      fireEvent.click(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Generate" }));

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save changes" }),
        ).toBeDisabled(),
      );

      resolveAssist(jsonResponse({ data: { text: "اقتراح" } }));

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save changes" }),
        ).not.toBeDisabled(),
      );
    });
  });
});
