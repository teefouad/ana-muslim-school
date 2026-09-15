import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonForm, type LessonFormProps } from "./lesson-form";
import type { MockLesson } from "./mock-lessons";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const LESSON: MockLesson = {
  id: "lesson-1",
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
      <LessonForm lesson={LESSON} onChange={onChange} {...overrides} />
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

  it("seeds every field from the given Lesson", () => {
    renderForm({
      lesson: { ...LESSON, type: "video", isPublished: true, position: 4 },
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

    expect(onChange).toHaveBeenCalledWith(LESSON.id, { type: "video" });
  });

  it("calls onChange with the updated Title", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "عنوان جديد" },
    });

    expect(onChange).toHaveBeenCalledWith(LESSON.id, {
      title: { ar: "عنوان جديد", en: "" },
    });
  });

  it("calls onChange with the updated One-line description", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText("One-line description"), {
      target: { value: "وصف جديد" },
    });

    expect(onChange).toHaveBeenCalledWith(LESSON.id, {
      description: { ar: "وصف جديد", en: "" },
    });
  });

  it("calls onChange with Published toggled", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("switch", { name: "Published" }));

    expect(onChange).toHaveBeenCalledWith(LESSON.id, { isPublished: true });
  });

  it("calls onChange with the selected Position", () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "4" }));

    expect(onChange).toHaveBeenCalledWith(LESSON.id, { position: 4 });
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
      expect(onChange).toHaveBeenCalledWith(LESSON.id, {
        title: { ar: "المقدمة", en: "Introduction" },
      }),
    );
  });

  it("never issues a network request for a local, non-translation edit", () => {
    renderForm();

    fireEvent.click(screen.getByRole("switch", { name: "Published" }));
    fireEvent.click(screen.getByRole("radio", { name: "0" }));

    expect(fetch).not.toHaveBeenCalled();
  });
});
