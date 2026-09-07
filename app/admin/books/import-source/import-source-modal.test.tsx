import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Button, MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  usePdfDocumentMock,
  requestOcrUploadUrlMock,
  uploadPdfToStorageMock,
  requestOcrMock,
  useMediaQueryMock,
} = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
  requestOcrUploadUrlMock: vi.fn(),
  uploadPdfToStorageMock: vi.fn(),
  requestOcrMock: vi.fn(),
  useMediaQueryMock: vi.fn(),
}));

vi.mock("./use-pdf-document", () => ({
  usePdfDocument: usePdfDocumentMock,
}));

// jsdom's `matchMedia` (stubbed in vitest.setup.ts) always reports
// `matches: false`, so the mobile/`fullScreen` branch below needs
// `useMediaQuery` itself mocked -- every other `@mantine/hooks` export is
// kept real since Mantine's own components rely on them internally.
vi.mock("@mantine/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/hooks")>()),
  useMediaQuery: useMediaQueryMock,
}));

vi.mock("./ocr-client", () => ({
  requestOcrUploadUrl: requestOcrUploadUrlMock,
  uploadPdfToStorage: uploadPdfToStorageMock,
  requestOcr: requestOcrMock,
}));

const { ImportSourceModal } = await import("./import-source-modal");

function pdfFile(name = "book.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function renderModal(
  overrides: Partial<React.ComponentProps<typeof ImportSourceModal>> = {},
) {
  const props: React.ComponentProps<typeof ImportSourceModal> = {
    opened: true,
    onClose: vi.fn(),
    bookId: "book-1",
    ...overrides,
  };

  const utils = render(
    <MantineProvider>
      <ImportSourceModal {...props} />
    </MantineProvider>,
  );

  return { ...utils, ...props };
}

async function selectFile(name = "book.pdf") {
  const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pdfFile(name)] } });
  // PdfViewer is loaded via next/dynamic({ ssr: false }) (see pdf-viewer.tsx)
  // -- its module resolves asynchronously even with usePdfDocument mocked.
  await screen.findByText(name);
}

describe("ImportSourceModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePdfDocumentMock.mockReturnValue({
      doc: {},
      numPages: 3,
      isLoading: false,
      error: null,
    });
    useMediaQueryMock.mockReturnValue(false);
  });

  it("sizes near-full desktop width with a small fixed gutter, not fullScreen", () => {
    renderModal();

    const root = document.querySelector(".mantine-Modal-root");
    const content = document.querySelector('[data-modal-content="true"]');

    // Mantine's Modal.Inner reserves its own horizontal padding around the
    // content by default (`--modal-x-offset: 5vw`) regardless of `size` --
    // a plain width override alone still gets clamped back down to ~90vw
    // by that padding, so both need to be set together (see
    // import-source-modal.module.css for the fuller explanation).
    expect(root).toHaveAttribute(
      "style",
      expect.stringContaining("--modal-size: min(1800px, calc(100vw - 48px))"),
    );
    expect(root).toHaveAttribute(
      "style",
      expect.stringContaining("--modal-x-offset:"),
    );
    expect(content).not.toHaveAttribute("data-full-screen", "true");
  });

  it("uses fullScreen with edge-to-edge sizing on narrow viewports", () => {
    useMediaQueryMock.mockReturnValue(true);
    renderModal();

    const root = document.querySelector(".mantine-Modal-root");
    const content = document.querySelector('[data-modal-content="true"]');

    expect(root).toHaveAttribute(
      "style",
      expect.stringContaining("--modal-size: 100%"),
    );
    expect(content).toHaveAttribute("data-full-screen", "true");
  });

  it("starts at the PDF picker", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
  });

  it("moves to the PDF viewer once a file is selected", async () => {
    renderModal();

    await selectFile();

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(screen.getByText("/ 3")).toBeInTheDocument();
  });

  it("closing and reopening the modal discards its temporary state, starting at the picker again", async () => {
    // Mirrors how the real Edit Book page wires this up (see [id]/edit/
    // page.tsx): `opened` is owned by the parent, and only ever becomes
    // false as a result of the modal's own onClose firing -- so closing via
    // Escape here exercises the exact same resetState() path a real close
    // (X button/overlay click) would, and the "Reopen" button mirrors
    // clicking Import Source again.
    function Harness() {
      const [opened, setOpened] = useState(true);
      return (
        <>
          <Button onClick={() => setOpened(true)}>Reopen</Button>
          <ImportSourceModal
            opened={opened}
            onClose={() => setOpened(false)}
            bookId="book-1"
          />
        </>
      );
    }

    render(
      <MantineProvider>
        <Harness />
      </MantineProvider>,
    );
    await selectFile();
    expect(screen.getByText("book.pdf")).toBeInTheDocument();

    // Closing resets state immediately (resetState() runs before onClose),
    // so the dialog's own content already reflects the picker again while
    // Mantine's exit transition is still fading it out.
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(
      await screen.findByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("book.pdf")).not.toBeInTheDocument();

    // Reopening (the parent flipping `opened` back to true, as clicking
    // Import Source again would) still starts at the picker.
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

    expect(
      await screen.findByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("book.pdf")).not.toBeInTheDocument();
  });

  it("choosing a different file from the viewer resets to the picker", async () => {
    renderModal();
    await selectFile();

    fireEvent.click(
      screen.getByRole("button", { name: "Choose a different file" }),
    );

    expect(
      screen.getByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
  });

  it("runs OCR, advances to review, and Back returns to page selection retaining the OCR result", async () => {
    requestOcrUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://storage/signed",
      objectPath: "tmp/ocr-uploads/user-1/book.pdf",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValue({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 100,
      pages: [{ pageNumber: 1, markdown: "# Hello" }],
    });

    renderModal();
    await selectFile();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));

    expect(
      await screen.findByRole("button", { name: "Create Modules" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Extracted text for page 1")).toHaveValue(
      "# Hello",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Back to page selection" }),
    );

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select page 1" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("Create Modules advances to the Module builder using edited OCR Markdown", async () => {
    requestOcrUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://storage/signed",
      objectPath: "tmp/ocr-uploads/user-1/book.pdf",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValue({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 100,
      pages: [{ pageNumber: 1, markdown: "Original" }],
    });

    renderModal();
    await selectFile();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));

    await screen.findByRole("button", { name: "Create Modules" });

    fireEvent.change(screen.getByLabelText("Extracted text for page 1"), {
      target: { value: "Edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Learning Material" }),
    ).toBeDisabled();
  });

  it("clears temporary Modules built from an earlier document when the source is replaced with a new file", async () => {
    // Regression test (PR review feedback for ANA-68, blocking): a user
    // could create temporary Modules, go Back -> Back to page selection ->
    // choose another file, run OCR on it, and still see the previous
    // document's Modules in the Module builder -- `modules` state survived
    // a source swap even though it was built from text that no longer
    // exists anywhere in the flow.
    requestOcrUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://storage/signed",
      objectPath: "tmp/ocr-uploads/user-1/book.pdf",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValueOnce({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 100,
      pages: [{ pageNumber: 1, markdown: "First document text" }],
    });

    renderModal();
    await selectFile("book.pdf");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));
    await screen.findByRole("button", { name: "Create Modules" });
    fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

    // Select the extracted text and create a temporary Module from it.
    const source = screen.getByText(/First document text/);
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode() as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
    expect(screen.getByText("Modules (1)")).toBeInTheDocument();

    // Back to review, back to page selection, choose a different file.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Back to page selection" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Choose a different file" }),
    );

    // Run OCR again on a new document.
    requestOcrMock.mockResolvedValueOnce({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 100,
      pages: [{ pageNumber: 1, markdown: "Second document text" }],
    });
    await selectFile("book-2.pdf");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));
    await screen.findByRole("button", { name: "Create Modules" });
    fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

    expect(screen.queryByText(/Modules \(/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Select text on the left and click “Create Module” to get started.",
      ),
    ).toBeInTheDocument();
  });

  async function reachBuildModulesWithOneModule() {
    requestOcrUploadUrlMock.mockResolvedValue({
      uploadUrl: "https://storage/signed",
      objectPath: "tmp/ocr-uploads/user-1/book.pdf",
    });
    uploadPdfToStorageMock.mockResolvedValue(undefined);
    requestOcrMock.mockResolvedValueOnce({
      model: "mistral-ocr-latest",
      pagesProcessed: 1,
      docSizeBytes: 100,
      pages: [{ pageNumber: 1, markdown: "Some source text" }],
    });

    renderModal();
    await selectFile();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));
    await screen.findByRole("button", { name: "Create Modules" });
    fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

    const source = screen.getByText(/Some source text/);
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode() as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
    expect(screen.getByText("Modules (1)")).toBeInTheDocument();
  }

  it("Create Learning Material advances to the Learning Material step, showing the filename and Module count", async () => {
    await reachBuildModulesWithOneModule();

    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 module created")).toBeInTheDocument();
    expect(await screen.findByText("Some")).toBeInTheDocument();
  });

  it("Back to Modules returns to the Module builder, preserving the temporary Modules", async () => {
    await reachBuildModulesWithOneModule();
    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );
    await screen.findByText("1 module created");

    fireEvent.click(screen.getByRole("button", { name: "Back to Modules" }));

    expect(screen.getByText("Modules (1)")).toBeInTheDocument();
  });

  it("returning to the Module builder and back to Learning Material shows the same Module, not a reset flow", async () => {
    // The Learning Material screen's own persistence of *edits* across a
    // remount (Back -> Create Learning Material again) is covered by
    // learning-material-view.test.tsx, using non-empty seed content --
    // jsdom's contenteditable emulation can't place a cursor in a
    // genuinely empty Lexical document (see components/ui/markdown-editor
    // .test.tsx's own tests, which only ever type onto existing content),
    // so a real Learning Material edit can't be driven end-to-end from
    // this modal's actual empty starting state. This instead exercises
    // the modal-level plumbing: the same Module set (not e.g. an emptied
    // or duplicated one) is what comes back after a Back -> forward round
    // trip.
    await reachBuildModulesWithOneModule();
    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );
    await screen.findByText("1 module created");

    fireEvent.click(screen.getByRole("button", { name: "Back to Modules" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );

    expect(screen.getByText("1 module created")).toBeInTheDocument();
    expect(await screen.findByText("Some")).toBeInTheDocument();
  });

  it("makes no API/network requests from the Learning Material step", async () => {
    await reachBuildModulesWithOneModule();
    vi.stubGlobal("fetch", vi.fn());

    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );
    await screen.findByText("1 module created");
    await screen.findByRole("toolbar");

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
