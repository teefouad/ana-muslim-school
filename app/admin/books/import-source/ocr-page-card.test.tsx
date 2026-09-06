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
