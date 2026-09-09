import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// PdfViewer's own page-navigation/zoom/selection logic is what these tests
// cover -- real pdf.js parsing (worker-based, browser-only) is exercised
// for real in Storybook's browser test runner instead, so the document
// itself is mocked here to keep these fast and environment-independent.
const { usePdfDocumentMock } = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
}));

vi.mock("./use-pdf-document", () => ({
  usePdfDocument: usePdfDocumentMock,
}));

const { default: PdfViewer } = await import("./pdf-viewer-core");
type PdfViewerProps = React.ComponentProps<typeof PdfViewer>;

function fakeFile(name = "sample.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function mockDocument(numPages: number) {
  usePdfDocumentMock.mockReturnValue({
    doc: {},
    numPages,
    isLoading: false,
    error: null,
  });
}

function renderViewer(
  overrides: Partial<PdfViewerProps> & { numPages?: number } = {},
) {
  const { numPages = 10, ...rest } = overrides;
  mockDocument(numPages);

  const props: PdfViewerProps = {
    file: fakeFile("sample.pdf"),
    selectedPages: new Set<number>(),
    onSelectedPagesChange: vi.fn(),
    onChooseDifferentFile: vi.fn(),
    onRunOcr: vi.fn(),
    isRunningOcr: false,
    ocrError: null,
    ...rest,
  };

  render(
    <MantineProvider>
      <PdfViewer {...props} />
    </MantineProvider>,
  );

  return props;
}

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the filename and page count", () => {
    renderViewer({ file: fakeFile("book.pdf"), numPages: 10 });

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(screen.getByText("/ 10")).toBeInTheDocument();
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    renderViewer({ numPages: 2 });

    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByLabelText("Current page")).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("reverts an out-of-range direct page input to the current page on blur", () => {
    renderViewer({ numPages: 5 });
    const input = screen.getByLabelText("Current page");

    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("1");
  });

  it("reverts a non-numeric direct page input to the current page on blur", () => {
    renderViewer({ numPages: 5 });
    const input = screen.getByLabelText("Current page");

    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("1");
  });

  it("navigates to a valid direct page input on Enter", () => {
    renderViewer({ numPages: 5 });
    const input = screen.getByLabelText("Current page");

    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByLabelText("Current page")).toHaveValue("3");
  });

  it("zooms from 100% in 25% steps between 50% and 250%", () => {
    renderViewer();

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(zoomIn);
    expect(screen.getByText("125%")).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(zoomIn);
    }
    expect(screen.getByText("250%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(zoomOut);
    }
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();
  });

  it("calls onChooseDifferentFile when 'Choose a different file' is clicked", () => {
    const onChooseDifferentFile = vi.fn();
    renderViewer({ onChooseDifferentFile });

    fireEvent.click(
      screen.getByRole("button", { name: "Choose a different file" }),
    );

    expect(onChooseDifferentFile).toHaveBeenCalled();
  });

  it("previewing a thumbnail does not select it", () => {
    const onSelectedPagesChange = vi.fn();
    renderViewer({ onSelectedPagesChange });

    fireEvent.click(screen.getByRole("button", { name: "Preview page 3" }));

    expect(onSelectedPagesChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current page")).toHaveValue("3");
  });

  it("toggles a page's selection via its checkbox", () => {
    const onSelectedPagesChange = vi.fn();
    renderViewer({ onSelectedPagesChange });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 2" }));

    expect(onSelectedPagesChange).toHaveBeenCalledWith(new Set([2]));
  });

  it("supports shift-click range selection from the last explicitly selected page", () => {
    const onSelectedPagesChange = vi.fn();
    mockDocument(10);
    const { rerender } = render(
      <MantineProvider>
        <PdfViewer
          file={fakeFile()}
          selectedPages={new Set()}
          onSelectedPagesChange={onSelectedPagesChange}
          onChooseDifferentFile={vi.fn()}
          onRunOcr={vi.fn()}
          isRunningOcr={false}
          ocrError={null}
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 2" }));
    expect(onSelectedPagesChange).toHaveBeenLastCalledWith(new Set([2]));

    rerender(
      <MantineProvider>
        <PdfViewer
          file={fakeFile()}
          selectedPages={new Set([2])}
          onSelectedPagesChange={onSelectedPagesChange}
          onChooseDifferentFile={vi.fn()}
          onRunOcr={vi.fn()}
          isRunningOcr={false}
          ocrError={null}
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 5" }), {
      shiftKey: true,
    });

    expect(onSelectedPagesChange).toHaveBeenLastCalledWith(
      new Set([2, 3, 4, 5]),
    );
  });

  it("Select all selects every page and Clear selection is disabled with none selected", () => {
    const onSelectedPagesChange = vi.fn();
    renderViewer({ onSelectedPagesChange, numPages: 4 });

    expect(
      screen.getByRole("button", { name: "Clear selection" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onSelectedPagesChange).toHaveBeenLastCalledWith(
      new Set([1, 2, 3, 4]),
    );
  });

  it("Clear selection empties the current selection", () => {
    const onSelectedPagesChange = vi.fn();
    renderViewer({ onSelectedPagesChange, selectedPages: new Set([1, 2]) });

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onSelectedPagesChange).toHaveBeenCalledWith(new Set());
  });

  it("shows the correct singular/plural selected-pages count", () => {
    renderViewer({ numPages: 1, selectedPages: new Set([1]) });

    expect(screen.getByText("1 of 1 page selected")).toBeInTheDocument();
  });

  it("disables Process Pages when zero pages are selected", () => {
    renderViewer({ selectedPages: new Set() });

    expect(
      screen.getByRole("button", { name: /Process Pages/ }),
    ).toBeDisabled();
  });

  it("enables Process Pages once pages are selected and calls onRunOcr with sorted pages", () => {
    const onRunOcr = vi.fn();
    renderViewer({ selectedPages: new Set([5, 2]), onRunOcr });

    const runOcr = screen.getByRole("button", { name: /Process Pages/ });
    expect(runOcr).toBeEnabled();

    fireEvent.click(runOcr);

    expect(onRunOcr).toHaveBeenCalledWith([2, 5]);
  });

  it("shows a loading state on the Process Pages button while OCR is in flight", () => {
    renderViewer({ selectedPages: new Set([1]), isRunningOcr: true });

    const runOcr = screen.getByRole("button", { name: /Process Pages/ });
    expect(
      within(runOcr).getByText("", { selector: ".mantine-Button-loader" }),
    ).toBeInTheDocument();
  });
});
