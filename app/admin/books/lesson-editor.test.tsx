import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DrawerShell } from "@/components/ui/drawer-shell";
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

/** Wraps the editor in a real `DrawerShell` -- `LessonEditor` always portals
 * Save changes into the owning drawer's own fixed footer via `DrawerFooter`,
 * the same as its only real caller (module-editor-body.tsx) always renders
 * it, so every test reuses this instead of re-declaring the same wrapper. */
function renderEditor(overrides: Partial<LessonEditorProps> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();
  const utils = render(
    <MantineProvider>
      <DrawerShell opened title="Edit Lesson" onClose={vi.fn()}>
        <LessonEditor
          lesson={LESSON}
          moduleQuestions={[]}
          previousModuleQuestions={[]}
          moduleTitle="عنوان الوحدة"
          moduleDescription="وصف الوحدة"
          moduleContent="محتوى الوحدة"
          onCreate={onCreate}
          onUpdate={onUpdate}
          onBack={onBack}
          {...overrides}
        />
      </DrawerShell>
    </MantineProvider>,
  );
  return { onCreate, onUpdate, onBack, ...utils };
}

describe("LessonEditor (ANA-115 UI, wired to the real backend in ANA-116)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the Lesson's fields, seeded from the given Lesson", () => {
    // No "Back to Module" control of its own (unlike its earlier ANA-115
    // design) -- that's now the owning container's own Title-bar control
    // (`module-editor-body.tsx`'s `ArrowLeft` button, ANA-121), which calls
    // this editor's `onBack` prop directly rather than through any dirty
    // check of its own (see module-editor-body.tsx's own comments for why
    // it isn't gated the way Cancel/Escape on the owning Edit Module
    // container itself still are).
    renderEditor();

    expect(screen.getByTestId("lesson-form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("المقدمة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("وصف قصير")).toBeInTheDocument();
  });

  describe("existing Lesson (update)", () => {
    it("calls onUpdate (not onCreate) with only this Lesson's id and fields, and stays in Lesson mode once it resolves (ANA-129 PR review: saving must never change the screen)", async () => {
      const { onCreate, onUpdate, onBack } = renderEditor();

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith(
          "lesson-1",
          {
            title: { ar: "عنوان جديد", en: "" },
            description: { ar: "وصف قصير", en: "" },
            type: "text",
            position: 0,
            isPublished: false,
            content: { ar: "", en: "" },
            videoURL: "",
            duration: 0,
            azkar: [],
            questions: [],
          },
          expect.any(Function),
        ),
      );
      expect(onCreate).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save changes" }),
        ).not.toHaveAttribute("data-loading"),
      );
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.getByTestId("lesson-form")).toBeInTheDocument();
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

      expect(
        screen.getByRole("radio", { name: "Quiz", checked: true }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("");
      expect(
        screen.getByRole("switch", { name: "Published" }),
      ).not.toBeChecked();
      expect(
        screen.getByRole("radio", { name: "2", checked: true }),
      ).toBeInTheDocument();
    });

    it("never calls onCreate merely by being rendered", () => {
      const { onCreate } = renderNewLessonEditor();

      expect(onCreate).not.toHaveBeenCalled();
    });

    it("calls onCreate (not onUpdate) exactly once and stays in Lesson mode once it resolves (ANA-129 PR review: saving must never change the screen)", async () => {
      const { onCreate, onUpdate, onBack } = renderNewLessonEditor();

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "مقدمة جديدة" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          {
            title: { ar: "مقدمة جديدة" },
            description: {},
            type: "quiz",
            position: 2,
            isPublished: false,
            content: {},
            videoURL: "",
            duration: 0,
            azkar: [],
            questions: [],
          },
          expect.any(Function),
        ),
      );
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save changes" }),
        ).not.toHaveAttribute("data-loading"),
      );
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.getByTestId("lesson-form")).toBeInTheDocument();
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
    it("exposes both Translate and AI Assistance for Title and Description", () => {
      renderEditor();

      expect(
        screen.getByRole("button", { name: "Translate Title with AI" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Translate Description with AI",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "AI Assistance for Description",
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
        jsonResponse({
          data: { ar: "اقتراح للعنوان", en: "Title suggestion" },
        }),
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

  describe("switching Lesson types preserves unsaved configuration (ANA-118)", () => {
    it("keeps a Video Lesson's Video URL/Duration after switching away to Break and back", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("radio", { name: "Video" }));
      fireEvent.change(screen.getByLabelText("Video URL"), {
        target: { value: "https://example.com/video.mp4" },
      });
      fireEvent.change(screen.getByLabelText("Duration"), {
        target: { value: "42" },
      });

      fireEvent.click(screen.getByRole("radio", { name: "Break" }));
      expect(screen.queryByLabelText("Video URL")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Video" }));
      expect(
        screen.getByDisplayValue("https://example.com/video.mp4"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    });

    it("keeps a Break Lesson's entries after switching away to Video and back", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("radio", { name: "Break" }));
      fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
      fireEvent.change(screen.getByLabelText("Text 1"), {
        target: { value: "سبحان الله" },
      });

      fireEvent.click(screen.getByRole("radio", { name: "Video" }));
      expect(screen.queryByText(/break entries/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Break" }));
      expect(screen.getByDisplayValue("سبحان الله")).toBeInTheDocument();
    });

    it("keeps a Quiz Lesson's Questions after switching away to Text and back (ANA-119)", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("radio", { name: "Quiz" }));
      fireEvent.click(screen.getByRole("button", { name: "New" }));
      const [textarea] = screen.getAllByRole("textbox", { name: "Question" });
      fireEvent.change(textarea, { target: { value: "ما هي الصلاة؟" } });

      fireEvent.click(screen.getByRole("radio", { name: "Text" }));
      expect(screen.queryByText("Questions")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Quiz" }));
      expect(screen.getByDisplayValue("ما هي الصلاة؟")).toBeInTheDocument();
    });
  });

  // ANA-125 PR review: Save changes portals into the owning `DrawerShell`'s
  // real footer via `DrawerFooter`, the same mechanism/footer Module mode's
  // own Save changes already uses in that drawer, not a second, bespoke
  // sticky/pinned section.
  it("portals Save changes into the owning DrawerShell's own fixed footer, outside the scrollable content region", () => {
    renderEditor();

    const scrollRegion = screen.getByTestId("drawer-scroll-region");
    expect(
      within(scrollRegion).queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  describe("Save is blocked while a Question's raw text is invalid (PR review, ANA-119)", () => {
    it("disables Save while a Question's textarea has a malformed choice marker, and re-enables it once fixed", () => {
      renderEditor();

      fireEvent.click(screen.getByRole("radio", { name: "Quiz" }));
      fireEvent.click(screen.getByRole("button", { name: "New" }));
      const textarea = screen.getByRole("textbox", { name: "Question" });

      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();

      fireEvent.change(textarea, { target: { value: "Q?\n\n[x]a" } });

      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();

      fireEvent.change(textarea, { target: { value: "Q?\n\n[x] a" } });

      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("never calls onCreate/onUpdate when Save is clicked while invalid (the button is disabled, not just visually)", () => {
      const { onCreate, onUpdate } = renderEditor({ lesson: null });

      fireEvent.click(screen.getByRole("radio", { name: "Quiz" }));
      fireEvent.click(screen.getByRole("button", { name: "New" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Question" }), {
        target: { value: "Q?\n\n[x]a" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(onCreate).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});
