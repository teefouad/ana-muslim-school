import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Button, MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

const {
  usePdfDocumentMock,
  requestOcrUploadUrlMock,
  uploadPdfToStorageMock,
  requestOcrMock,
  useMediaQueryMock,
  createModuleMock,
  createSourceMock,
  deleteSourceMock,
  createMaterialMock,
} = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
  requestOcrUploadUrlMock: vi.fn(),
  uploadPdfToStorageMock: vi.fn(),
  requestOcrMock: vi.fn(),
  useMediaQueryMock: vi.fn(),
  createModuleMock: vi.fn(),
  createSourceMock: vi.fn(),
  deleteSourceMock: vi.fn(),
  createMaterialMock: vi.fn(),
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

vi.mock("./modules-client", () => ({
  createModule: createModuleMock,
}));

vi.mock("./sources-client", () => ({
  createSource: createSourceMock,
  deleteSource: deleteSourceMock,
}));

vi.mock("./materials-client", () => ({
  createMaterial: createMaterialMock,
}));

const { ImportSourceModal } = await import("./import-source-modal");

function pdfFile(name = "book.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The only raw (non-client-wrapper) fetch this modal makes is the
 * Source-by-bookId SWR read -- every test gets a "no saved Source" default
 * via the global `fetch` stub below unless it overrides `fetch` itself. */
function mockNoSavedSource() {
  (fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
    const url = String(input);

    if (url.startsWith("/api/v1/sources?bookId=")) {
      return Promise.resolve(jsonResponse({ data: [] }));
    }

    throw new Error(`Unhandled fetch in test: ${url}`);
  });
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
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak the Source-by-bookId fixture across test cases keyed by
          the same URL (see AGENTS.md's SWR testing convention). */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ImportSourceModal {...props} />
      </SWRConfig>
    </MantineProvider>,
  );

  return { ...utils, ...props };
}

async function selectFile(name = "book.pdf") {
  // The Source-by-bookId lookup (ANA-71) resolves asynchronously before the
  // upload flow (including this picker) renders at all -- `findByTestId`
  // waits for that instead of assuming the picker is already there.
  const input = (await screen.findByTestId(
    "pdf-file-input",
  )) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pdfFile(name)] } });
  // PdfViewer is loaded via next/dynamic({ ssr: false }) (see pdf-viewer.tsx)
  // -- its module resolves asynchronously even with usePdfDocument mocked.
  await screen.findByText(name);
}

describe("ImportSourceModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockNoSavedSource();
    usePdfDocumentMock.mockReturnValue({
      doc: {},
      numPages: 3,
      isLoading: false,
      error: null,
    });
    useMediaQueryMock.mockReturnValue(false);
    createModuleMock.mockImplementation(() =>
      Promise.resolve({
        id: `created-${createModuleMock.mock.calls.length}`,
        title: { ar: "", en: "" },
        description: { ar: "", en: "" },
        color: "",
        lessons: [],
        isLocked: false,
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "actor@example.com",
        updatedBy: "actor@example.com",
      }),
    );
    createSourceMock.mockImplementation((bookId: string, content: string) =>
      Promise.resolve({ id: "source-1", bookId, content }),
    );
    deleteSourceMock.mockResolvedValue(undefined);
    createMaterialMock.mockImplementation(
      (bookId: string, moduleId: string, content: string) =>
        Promise.resolve({
          id: `material-${createMaterialMock.mock.calls.length}`,
          bookId,
          moduleId,
          content,
        }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("shows a loading state while looking up a saved Source", () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderModal();

    expect(screen.getByText("Loading source…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Choose a PDF to import" }),
    ).not.toBeInTheDocument();
  });

  it("starts at the PDF picker once the Source lookup finds nothing", async () => {
    renderModal();

    expect(
      await screen.findByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
  });

  it("shows an error instead of silently falling back to the upload flow when the Source lookup fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Sources are unavailable." }, 500),
    );
    renderModal();

    expect(
      await screen.findByText("Sources are unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Choose a PDF to import" }),
    ).not.toBeInTheDocument();
  });

  it("opens directly on the saved-source view when the Book already has a Source", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/sources?bookId=")) {
        return Promise.resolve(
          jsonResponse({
            data: [{ id: "source-1", bookId: "book-1", content: "Saved text" }],
          }),
        );
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });
    renderModal();

    expect(await screen.findByLabelText("Saved source text")).toHaveValue(
      "Saved text",
    );
    expect(
      screen.queryByRole("button", { name: "Choose a PDF to import" }),
    ).not.toBeInTheDocument();
  });

  describe("Remove source text", () => {
    function mockExistingSource(content = "Saved text") {
      (fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
        const url = String(input);
        if (url.startsWith("/api/v1/sources?bookId=")) {
          return Promise.resolve(
            jsonResponse({
              data: [{ id: "source-1", bookId: "book-1", content }],
            }),
          );
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      });
    }

    it("calls DELETE /api/v1/sources/{sourceId} and returns to the upload flow on success", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Saved source text");

      // After the DELETE succeeds, the SWR revalidation re-fetches -- this
      // second response is what flips the modal back to the upload flow.
      (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce((input) => {
        const url = String(input);
        if (url.startsWith("/api/v1/sources?bookId=")) {
          return Promise.resolve(jsonResponse({ data: [] }));
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Remove source text" }),
      );

      expect(
        await screen.findByRole("button", { name: "Choose a PDF to import" }),
      ).toBeInTheDocument();
      expect(deleteSourceMock).toHaveBeenCalledWith("source-1");
    });

    it("keeps the saved Source visible and shows an error when deletion fails", async () => {
      mockExistingSource();
      deleteSourceMock.mockRejectedValueOnce(new Error("Cannot delete."));
      renderModal();
      await screen.findByLabelText("Saved source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Remove source text" }),
      );

      expect(await screen.findByText("Cannot delete.")).toBeInTheDocument();
      expect(screen.getByLabelText("Saved source text")).toHaveValue(
        "Saved text",
      );
    });

    it("does not touch Modules or Materials when removing a Source", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Saved source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Remove source text" }),
      );

      await vi.waitFor(() => expect(deleteSourceMock).toHaveBeenCalled());
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createMaterialMock).not.toHaveBeenCalled();
    });
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
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <Harness />
        </SWRConfig>
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

  async function reachBuildModulesWithOneModule(
    overrides: Partial<React.ComponentProps<typeof ImportSourceModal>> = {},
  ) {
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

    const rendered = renderModal(overrides);
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

    return rendered;
  }

  function selectSourceRange(start: number, end: number) {
    const source = screen.getByText(/Some source text/);
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode() as Text;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
  }

  // Reaches the Learning Material step with two temporary Modules, built
  // (in order) from "Some " and "source" of the single OCR page's text --
  // used by the Finish tests below to exercise ordering across more than
  // one Module.
  async function reachLearningMaterialWithTwoModules() {
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

    selectSourceRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
    selectSourceRange(5, 11);
    fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
    expect(screen.getByText("Modules (2)")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Create Learning Material" }),
    );
    await screen.findByText("2 modules created");
  }

  function moduleFixture(id: string) {
    return {
      id,
      title: { ar: "", en: "" },
      description: { ar: "", en: "" },
      color: "",
      lessons: [],
      isLocked: false,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "actor@example.com",
      updatedBy: "actor@example.com",
    };
  }

  describe("Finish", () => {
    it("is enabled once a temporary Module exists", async () => {
      await reachBuildModulesWithOneModule();
      fireEvent.click(
        screen.getByRole("button", { name: "Create Learning Material" }),
      );
      await screen.findByText("1 module created");

      expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    });

    it("POSTs one Module per temporary Module, in order, with the exact draft payload", async () => {
      await reachLearningMaterialWithTwoModules();

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() => expect(createModuleMock).toHaveBeenCalledTimes(2));
      const draft = {
        title: { ar: "", en: "" },
        description: { ar: "", en: "" },
        color: "",
        isLocked: false,
        isPublished: false,
      };
      expect(createModuleMock).toHaveBeenNthCalledWith(1, "book-1", draft);
      expect(createModuleMock).toHaveBeenNthCalledWith(2, "book-1", draft);
    });

    it("does not duplicate requests from repeated clicks while Finish is already running", async () => {
      const { onClose } = await reachBuildModulesWithOneModule();
      fireEvent.click(
        screen.getByRole("button", { name: "Create Learning Material" }),
      );
      await screen.findByText("1 module created");

      let resolveCreate: (value: unknown) => void = () => {};
      createModuleMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );

      const finishButton = screen.getByRole("button", { name: "Finish" });
      fireEvent.click(finishButton);
      fireEvent.click(finishButton);
      fireEvent.click(finishButton);

      expect(createModuleMock).toHaveBeenCalledTimes(1);

      resolveCreate(moduleFixture("created-1"));
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("shows an inline error and keeps the modal open when Module creation fails", async () => {
      await reachBuildModulesWithOneModule();
      fireEvent.click(
        screen.getByRole("button", { name: "Create Learning Material" }),
      );
      await screen.findByText("1 module created");

      createModuleMock.mockRejectedValueOnce(new Error("Server exploded"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Server exploded")).toBeInTheDocument();
      expect(screen.getByText("book.pdf")).toBeInTheDocument();
    });

    it("disables Back to Modules once a Module has already been created, after a partial failure", async () => {
      // PR review (ANA-70, blocking): a Module created before a later
      // failure in the same Finish run already exists under the Book and
      // can't be rolled back from here -- Back to Modules must stay
      // disabled so the temporary set can't be reordered/deleted out from
      // under it. Retrying Finish is the only way forward.
      await reachLearningMaterialWithTwoModules();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createModuleMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      await screen.findByText("Network error");

      const backButton = screen.getByRole("button", {
        name: "Back to Modules",
      });
      expect(backButton).toBeDisabled();

      fireEvent.click(backButton);
      expect(screen.getByText("2 modules created")).toBeInTheDocument();
    });

    it("retrying after a partial failure does not recreate Modules that already succeeded", async () => {
      await reachLearningMaterialWithTwoModules();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createModuleMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createModuleMock).toHaveBeenCalledTimes(2);

      createModuleMock.mockClear();
      createModuleMock.mockResolvedValueOnce(moduleFixture("created-2"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      // Only the still-unsuccessful second temporary Module is retried --
      // the first, already created before the earlier failure, is skipped.
      await vi.waitFor(() => expect(createModuleMock).toHaveBeenCalledTimes(1));
    });

    it("closes the modal and refreshes the Edit Book Modules list once every Module succeeds", async () => {
      const onModulesCreated = vi.fn();
      const { onClose } = await reachBuildModulesWithOneModule({
        onModulesCreated,
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Create Learning Material" }),
      );
      await screen.findByText("1 module created");

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() => expect(onModulesCreated).toHaveBeenCalledTimes(1));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("persists the Source with the Book id and the full reviewed OCR text once every Module is created", async () => {
      await reachLearningMaterialWithTwoModules();

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createSourceMock).toHaveBeenCalledWith(
          "book-1",
          "Some source text",
        ),
      );
    });

    it("does not create the Source before every Module has been created", async () => {
      await reachLearningMaterialWithTwoModules();
      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createModuleMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createSourceMock).not.toHaveBeenCalled();
    });

    it("persists one Material per Module using the real persisted moduleId (never the temporary id), including an empty Learning Material", async () => {
      await reachLearningMaterialWithTwoModules();

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(2),
      );
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        1,
        "book-1",
        "created-1",
        "",
      );
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        2,
        "book-1",
        "created-2",
        "",
      );
      // "created-N" (the module fixture ids returned by createModuleMock) are
      // the only moduleId values ever passed -- never a temporary Module id
      // (which the Module builder generates via crypto.randomUUID()-style
      // ids, not this "created-N" shape).
      for (const call of createMaterialMock.mock.calls) {
        expect(call[1]).toMatch(/^created-\d+$/);
      }
    });

    it("does not create Materials before the Source has been created", async () => {
      await reachLearningMaterialWithTwoModules();
      createSourceMock.mockRejectedValueOnce(new Error("Storage error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Storage error")).toBeInTheDocument();
      expect(createMaterialMock).not.toHaveBeenCalled();
    });

    it("retrying after a Material failure does not recreate the Modules or the Source, and skips the Material that already succeeded", async () => {
      await reachLearningMaterialWithTwoModules();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-1",
        bookId: "book-1",
        moduleId: "created-1",
        content: "",
      });
      createMaterialMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createModuleMock).toHaveBeenCalledTimes(2);
      expect(createSourceMock).toHaveBeenCalledTimes(1);
      expect(createMaterialMock).toHaveBeenCalledTimes(2);

      createModuleMock.mockClear();
      createSourceMock.mockClear();
      createMaterialMock.mockClear();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-2",
        bookId: "book-1",
        moduleId: "created-2",
        content: "",
      });

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(1),
      );
      expect(createMaterialMock).toHaveBeenCalledWith(
        "book-1",
        "created-2",
        "",
      );
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createSourceMock).not.toHaveBeenCalled();
    });
  });

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
