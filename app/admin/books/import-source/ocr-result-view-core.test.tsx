import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OcrResult } from "@/lib/sources/ocr-types";

const { usePdfDocumentMock } = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
}));

vi.mock("./use-pdf-document", () => ({
  usePdfDocument: usePdfDocumentMock,
}));

const { default: OcrResultView } = await import("./ocr-result-view-core");
type OcrResultViewProps = React.ComponentProps<typeof OcrResultView>;

const SAMPLE_RESULT: OcrResult = {
  model: "mistral-ocr-latest",
  pagesProcessed: 2,
  docSizeBytes: 2_500_000,
  pages: [
    { pageNumber: 1, markdown: "# Page one" },
    { pageNumber: 2, markdown: "" },
  ],
};

function fakeFile(name = "book.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function renderView(overrides: Partial<OcrResultViewProps> = {}) {
  usePdfDocumentMock.mockReturnValue({
    doc: {},
    isLoading: false,
    error: null,
  });

  const props: OcrResultViewProps = {
    file: fakeFile(),
    ocrResult: SAMPLE_RESULT,
    editedMarkdown: Object.fromEntries(
      SAMPLE_RESULT.pages.map((page) => [page.pageNumber, page.markdown]),
    ),
    onEditedMarkdownChange: vi.fn(),
    fontScale: 100,
    onFontScaleChange: vi.fn(),
    direction: "rtl",
    onDirectionChange: vi.fn(),
    onBack: vi.fn(),
    onCreateModules: vi.fn(),
    ...overrides,
  };

  render(
    <MantineProvider>
      <OcrResultView {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("OcrResultView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the document summary: filename, pages processed, model, and size", () => {
    renderView();

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(/2 pages processed.*mistral-ocr-latest.*2\.4 MB/),
    ).toBeInTheDocument();
  });

  it("renders every selected page with its editable Markdown", () => {
    renderView();

    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Extracted text for page 1")).toHaveValue(
      "# Page one",
    );
    expect(screen.getByLabelText("Extracted text for page 2")).toHaveValue("");
  });

  it("edits call onEditedMarkdownChange with the full updated map", () => {
    const onEditedMarkdownChange = vi.fn();
    renderView({ onEditedMarkdownChange });

    fireEvent.change(screen.getByLabelText("Extracted text for page 1"), {
      target: { value: "# Edited" },
    });

    expect(onEditedMarkdownChange).toHaveBeenCalledWith({
      1: "# Edited",
      2: "",
    });
  });

  it("propagates font-scale changes from FontSizeControl", () => {
    const onFontScaleChange = vi.fn();
    renderView({ onFontScaleChange });

    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));

    expect(onFontScaleChange).toHaveBeenCalledWith(125);
  });

  it("propagates direction changes from TextDirectionControl", () => {
    const onDirectionChange = vi.fn();
    renderView({ onDirectionChange, direction: "rtl" });

    fireEvent.click(screen.getByRole("button", { name: "Left to right" }));

    expect(onDirectionChange).toHaveBeenCalledWith("ltr");
  });

  it("Back to page selection calls onBack", () => {
    const onBack = vi.fn();
    renderView({ onBack });

    fireEvent.click(
      screen.getByRole("button", { name: "Back to page selection" }),
    );

    expect(onBack).toHaveBeenCalled();
  });

  it("Create Modules calls onCreateModules", () => {
    const onCreateModules = vi.fn();
    renderView({ onCreateModules });

    fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

    expect(onCreateModules).toHaveBeenCalled();
  });
});
