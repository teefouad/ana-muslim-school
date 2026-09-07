import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import type { PdfDocument } from "@/lib/pdf/pdf-document";
import { OcrPageCard } from "./ocr-page-card";

const fakeDoc = {} as PdfDocument;

function renderCard(
  overrides: Partial<React.ComponentProps<typeof OcrPageCard>> = {},
) {
  return render(
    <MantineProvider>
      <OcrPageCard
        doc={fakeDoc}
        pageNumber={1}
        markdown="Hello"
        onMarkdownChange={vi.fn()}
        fontScale={100}
        direction="rtl"
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("OcrPageCard", () => {
  it("shows the page label", () => {
    renderCard({ pageNumber: 4 });

    expect(screen.getByText("Page 4")).toBeInTheDocument();
  });

  it("shows the placeholder when the page has no extracted text", () => {
    renderCard({ markdown: "" });

    expect(
      screen.getByPlaceholderText("No text was extracted from this page."),
    ).toBeInTheDocument();
  });

  it("calls onMarkdownChange with the edited text", () => {
    const onMarkdownChange = vi.fn();
    renderCard({ onMarkdownChange });

    fireEvent.change(screen.getByLabelText("Extracted text for page 1"), {
      target: { value: "Edited" },
    });

    expect(onMarkdownChange).toHaveBeenCalledWith("Edited");
  });

  it("applies the given text direction to the textarea", () => {
    renderCard({ direction: "ltr" });

    // Mantine's Textarea places `dir` on its input wrapper rather than the
    // native <textarea> itself -- direction still cascades to the textarea
    // through normal HTML `dir` inheritance.
    const textarea = screen.getByLabelText("Extracted text for page 1");
    expect(textarea.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });

  it("stretches the textarea to fill the card's height rather than a fixed row count", () => {
    // jsdom doesn't compute real layout, so this can't assert the actual
    // rendered pixel height (verified visually instead, see PR notes) --
    // it documents the fix's mechanism: without `autosize`, Mantine's
    // Textarea silently drops `minRows` and falls back to the browser's
    // tiny ~2-row default, so the textarea must flex-fill its column
    // (stretched by `.row`'s `align-items: stretch` to match the preview
    // column's height) via explicit flex/height styles instead.
    renderCard();

    const textarea = screen.getByLabelText("Extracted text for page 1");
    expect(textarea).toHaveStyle({ flex: "1 1 0%", height: "100%" });

    const wrapper = textarea.parentElement;
    expect(wrapper?.className).toMatch(/textareaWrapper/);

    const root = wrapper?.parentElement;
    expect(root?.className).toMatch(/textareaRoot/);
  });

  it("starts the split divider at 50% and clamps keyboard resizing to 15-85%", () => {
    renderCard();
    const handle = screen.getByRole("separator", {
      name: "Resize page 1 preview",
    });

    expect(handle).toHaveAttribute("aria-valuenow", "50");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "45");

    for (let i = 0; i < 10; i += 1) {
      fireEvent.keyDown(handle, { key: "ArrowLeft" });
    }
    expect(handle).toHaveAttribute("aria-valuenow", "15");

    for (let i = 0; i < 20; i += 1) {
      fireEvent.keyDown(handle, { key: "ArrowRight" });
    }
    expect(handle).toHaveAttribute("aria-valuenow", "85");
  });
});
