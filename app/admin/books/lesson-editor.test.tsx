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

const LESSON = buildLessonFixture({
  id: "lesson-1",
  title: { ar: "المقدمة", en: "" },
  description: { ar: "وصف قصير", en: "" },
});

function renderEditor(overrides: Partial<LessonEditorProps> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();
  const utils = render(
    <MantineProvider>
      <LessonEditor
        lesson={LESSON}
        onSave={onSave}
        onBack={onBack}
        {...overrides}
      />
    </MantineProvider>,
  );
  return { onSave, onBack, ...utils };
}

describe("LessonEditor (ANA-115)", () => {
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

  it("calls onSave with only this Lesson's id and fields when Save lesson is clicked", async () => {
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));

    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("lesson-1", {
        title: { ar: "عنوان جديد", en: "" },
        description: { ar: "وصف قصير", en: "" },
        type: "text",
        position: 0,
        isPublished: false,
      }),
    );
  });

  it("does not call onBack itself once the save resolves -- the caller owns returning to Module mode", async () => {
    const { onSave, onBack } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));

    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onBack).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the draft when the save fails, without calling onBack", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Lesson not found."));
    const { onBack } = renderEditor({ onSave });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));

    expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("عنوان جديد")).toBeInTheDocument();
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
        screen.getByRole("button", { name: "Save lesson" }),
      ).toBeDisabled(),
    );

    resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save lesson" }),
      ).not.toBeDisabled(),
    );
  });
});
