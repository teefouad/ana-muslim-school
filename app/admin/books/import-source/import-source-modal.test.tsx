import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button, MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  usePdfDocumentMock,
  requestOcrUploadUrlMock,
  uploadPdfToStorageMock,
  requestOcrMock,
} = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
  requestOcrUploadUrlMock: vi.fn(),
  uploadPdfToStorageMock: vi.fn(),
  requestOcrMock: vi.fn(),
}));

vi.mock("./use-pdf-document", () => ({
  usePdfDocument: usePdfDocumentMock,
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
});
