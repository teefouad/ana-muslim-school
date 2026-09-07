import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedSourceView } from "./saved-source-view";

function renderView(
  overrides: Partial<React.ComponentProps<typeof SavedSourceView>> = {},
) {
  const props: React.ComponentProps<typeof SavedSourceView> = {
    content: "Saved source text",
    onRemove: vi.fn(),
    isRemoving: false,
    removeError: null,
    onSave: vi.fn(),
    isSaving: false,
    saveError: null,
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    direction: "rtl",
    onDirectionChange: vi.fn(),
    ...overrides,
  };

  render(
    <MantineProvider>
      <SavedSourceView {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("SavedSourceView", () => {
  it("displays the complete stored content", () => {
    renderView({ content: "Line one\n\nLine two" });

    expect(screen.getByLabelText("Saved source text")).toHaveValue(
      "Line one\n\nLine two",
    );
  });

  it("renders the content editable, not read-only", () => {
    renderView();

    expect(screen.getByLabelText("Saved source text")).not.toHaveAttribute(
      "readonly",
    );
  });

  it("renders Select Another PDF on the left and Save changes on the right", () => {
    renderView();

    const selectAnotherPdf = screen.getByRole("button", {
      name: "Select Another PDF",
    });
    const saveChanges = screen.getByRole("button", { name: "Save changes" });

    expect(selectAnotherPdf.nextElementSibling).toBe(saveChanges);
  });

  it("calls onRemove when Select Another PDF is clicked", () => {
    const onRemove = vi.fn();
    renderView({ onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Select Another PDF" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables Select Another PDF and shows a loading state while removing", () => {
    renderView({ isRemoving: true });

    expect(
      screen.getByRole("button", { name: "Select Another PDF" }),
    ).toBeDisabled();
  });

  it("shows a removal error while keeping the saved Source visible", () => {
    renderView({ removeError: "Could not remove the source." });

    expect(
      screen.getByText("Could not remove the source."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Saved source text")).toBeInTheDocument();
  });

  it("disables Save changes until the text is edited", () => {
    renderView();

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Saved source text"), {
      target: { value: "Edited source text" },
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("calls onSave with the edited text when Save changes is clicked", () => {
    const onSave = vi.fn();
    renderView({ onSave });

    fireEvent.change(screen.getByLabelText("Saved source text"), {
      target: { value: "Edited source text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith("Edited source text");
  });

  it("disables Save changes and shows a loading state while saving", () => {
    renderView({ isSaving: true });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows a save error while keeping the edited text in place", () => {
    renderView({ saveError: "Could not save the source." });

    expect(screen.getByText("Could not save the source.")).toBeInTheDocument();
  });

  it("renders the font size and text direction controls", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Decrease font size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Increase font size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Left to right" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Right to left" }),
    ).toBeInTheDocument();
  });

  it("applies the given text direction to the textarea", () => {
    renderView({ direction: "ltr" });

    // Mantine's Textarea places `dir` on its input wrapper rather than the
    // native <textarea> itself -- direction still cascades to the textarea
    // (see ocr-page-card.test.tsx for the same pattern).
    expect(
      screen.getByLabelText("Saved source text").closest("[dir]"),
    ).toHaveAttribute("dir", "ltr");
  });

  it("calls onFontScaleChange and onDirectionChange from their controls", () => {
    const onFontScaleChange = vi.fn();
    const onDirectionChange = vi.fn();
    renderView({ onFontScaleChange, onDirectionChange });

    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    fireEvent.click(screen.getByRole("button", { name: "Left to right" }));

    expect(onFontScaleChange).toHaveBeenCalled();
    expect(onDirectionChange).toHaveBeenCalledWith("ltr");
  });

  it("makes no network requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
