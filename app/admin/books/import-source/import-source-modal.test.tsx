import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSWR, { SWRConfig, useSWRConfig } from "swr";

import { fetchJson } from "../fetch-json";
import type { TranslatableString } from "@/lib/learning-content/translatable-string";

const {
  usePdfDocumentMock,
  requestOcrUploadUrlMock,
  uploadPdfToStorageMock,
  requestOcrMock,
  useMediaQueryMock,
  createModuleMock,
  deleteModuleMock,
  reorderModulesMock,
  createSourceMock,
  deleteSourceMock,
  updateSourceMock,
  createMaterialMock,
  updateMaterialMock,
} = vi.hoisted(() => ({
  usePdfDocumentMock: vi.fn(),
  requestOcrUploadUrlMock: vi.fn(),
  uploadPdfToStorageMock: vi.fn(),
  requestOcrMock: vi.fn(),
  useMediaQueryMock: vi.fn(),
  createModuleMock: vi.fn(),
  deleteModuleMock: vi.fn(),
  reorderModulesMock: vi.fn(),
  createSourceMock: vi.fn(),
  deleteSourceMock: vi.fn(),
  updateSourceMock: vi.fn(),
  createMaterialMock: vi.fn(),
  updateMaterialMock: vi.fn(),
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
  deleteModule: deleteModuleMock,
  reorderModules: reorderModulesMock,
}));

vi.mock("./sources-client", () => ({
  createSource: createSourceMock,
  deleteSource: deleteSourceMock,
  updateSource: updateSourceMock,
}));

vi.mock("./materials-client", () => ({
  createMaterial: createMaterialMock,
  updateMaterial: updateMaterialMock,
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

// The Source Text panel's plain <textarea> also has an implicit
// role="textbox", alongside each Module's contenteditable MarkdownEditor --
// this narrows a `findAllByRole("textbox")` result down to just the latter.
async function findMaterialEditors() {
  const textboxes = await screen.findAllByRole("textbox");
  return textboxes.filter((el) => el.tagName !== "TEXTAREA");
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
    reorderModulesMock.mockImplementation((bookId: string, order: string[]) =>
      Promise.resolve({ id: bookId, modules: order }),
    );
    deleteSourceMock.mockResolvedValue(undefined);
    updateSourceMock.mockImplementation((id: string, content: string) =>
      Promise.resolve({ id, bookId: "book-1", content }),
    );
    createMaterialMock.mockImplementation(
      (bookId: string, moduleId: string, content: TranslatableString) =>
        Promise.resolve({
          id: `material-${createMaterialMock.mock.calls.length}`,
          bookId,
          moduleId,
          content,
        }),
    );
    updateMaterialMock.mockImplementation(
      (id: string, content: TranslatableString) =>
        Promise.resolve({
          id,
          bookId: "book-1",
          moduleId: "module-1",
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

  describe("Modal title (ANA-75)", () => {
    it("titles the modal Create from PDF for the upload/OCR/new-import workflow", async () => {
      renderModal();

      expect(
        await screen.findByRole("dialog", { name: "Create from PDF" }),
      ).toBeInTheDocument();
    });

    it("titles the modal Source Text for the saved-Source workspace", async () => {
      mockExistingSource();
      renderModal();

      expect(
        await screen.findByRole("dialog", { name: "Source Text" }),
      ).toBeInTheDocument();
    });

    it("switches the title back to Create from PDF once the saved Source is removed", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByRole("dialog", { name: "Source Text" });

      (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce((input) => {
        const url = String(input);
        if (url.startsWith("/api/v1/sources?bookId=")) {
          return Promise.resolve(jsonResponse({ data: [] }));
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Select Another PDF" }),
      );
      await screen.findByRole("dialog", { name: "Remove attached source?" });
      fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

      expect(
        await screen.findByRole("dialog", { name: "Create from PDF" }),
      ).toBeInTheDocument();
    });
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

  /** Serves the Source-by-bookId, Book Modules, and Book-filtered Materials
   * lookups the saved-Source workspace (ANA-72) needs before it can render
   * -- every "existing Source" test needs all three, not just the Source
   * one ANA-71 originally required. */
  function mockExistingSource({
    content = "Saved text",
    modules = [],
    materials = [],
  }: {
    content?: string;
    modules?: { id: string }[];
    materials?: {
      id: string;
      moduleId: string;
      content: TranslatableString;
    }[];
  } = {}) {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);

      if (url.startsWith("/api/v1/sources?bookId=")) {
        return Promise.resolve(
          jsonResponse({
            data: [{ id: "source-1", bookId: "book-1", content }],
          }),
        );
      }

      if (url === "/api/v1/books/book-1/modules") {
        return Promise.resolve(
          jsonResponse({
            data: modules.map((module) => moduleFixture(module.id)),
          }),
        );
      }

      if (url.startsWith("/api/v1/materials?bookId=")) {
        return Promise.resolve(jsonResponse({ data: materials }));
      }

      throw new Error(`Unhandled fetch in test: ${url}`);
    });
  }

  it("opens directly on the two-panel Source Text + Modules workspace when the Book already has a Source", async () => {
    mockExistingSource({ content: "Saved text" });
    renderModal();

    expect(await screen.findByLabelText("Source text")).toHaveValue(
      "Saved text",
    );
    expect(
      screen.queryByRole("button", { name: "Choose a PDF to import" }),
    ).not.toBeInTheDocument();
  });

  it("does not crash when the Book Modules SWR cache key was already populated by another consumer using EditBookPage's own unwrapping fetcher (regression, PR review)", async () => {
    // Bug report: clicking "View source text" after adding Modules via the
    // PDF import Finish flow crashed with "Cannot read properties of
    // undefined (reading 'map')". Root cause: this modal's own Modules SWR
    // hook shares its cache key (`/api/v1/books/{bookId}/modules`) with
    // EditBookPage's own Modules read (app/admin/books/[id]/edit/page.tsx)
    // -- SWR caches one value per key regardless of which hook's fetcher
    // produced it, and EditBookPage's fetcher unwraps the response to a
    // plain `Module[]`, not the raw `{ data: Module[] }` envelope. Whoever
    // populates the cache last determines the shape every other subscriber
    // of that key sees. This reproduces that coexistence directly: a
    // sibling hook using EditBookPage's exact fetcher populates the shared
    // cache first, then the modal mounts and must still render correctly
    // (not assume its own envelope shape).
    mockExistingSource({ modules: [{ id: "module-1" }], materials: [] });

    function Harness() {
      const [modalReady, setModalReady] = useState(false);
      const { data } = useSWR("/api/v1/books/book-1/modules", (url) =>
        fetchJson<{ data: unknown[] }>(url).then((response) => response.data),
      );

      // Same "adjust state during render" pattern as the modal's own
      // seeding logic -- mounts the modal only once this sibling's own
      // fetch has landed in the shared cache, so the modal's hook always
      // finds the key already populated in EditBookPage's shape.
      if (data && !modalReady) {
        setModalReady(true);
      }

      if (!modalReady) {
        return null;
      }

      return <ImportSourceModal opened onClose={vi.fn()} bookId="book-1" />;
    }

    render(
      <MantineProvider>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <Harness />
        </SWRConfig>
      </MantineProvider>,
    );

    expect(await screen.findByLabelText("Source text")).toBeInTheDocument();
    expect(screen.getByText("Modules (1)")).toBeInTheDocument();
  });

  it("ignores a background Source-lookup update once the upload workflow has started, instead of swapping to the saved-source view mid-session", async () => {
    // PR review (ANA-71, blocking): the Source-by-bookId SWR read still has
    // its default revalidateOnFocus/revalidateOnReconnect behavior. If a
    // background revalidation of that exact key resolves with data while
    // the user is mid-workflow (e.g. after Finish has already persisted the
    // Source but failed on a later Material), `existingSource` must not
    // flip the modal over to SavedSourceView and discard the in-progress
    // Learning Material/retry screen. This simulates "the cache for this
    // key changed for any reason" directly (a revalidateOnFocus/reconnect
    // event is one such reason, among others) via a sibling component
    // sharing the same isolated SWR cache as the modal.
    function RevalidateSourceButton() {
      const { mutate } = useSWRConfig();
      return (
        <button
          type="button"
          onClick={() =>
            mutate("/api/v1/sources?bookId=book-1", {
              data: [
                { id: "source-1", bookId: "book-1", content: "Saved text" },
              ],
            })
          }
        >
          Simulate background Source update
        </button>
      );
    }

    render(
      <MantineProvider>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <RevalidateSourceButton />
          <ImportSourceModal opened onClose={vi.fn()} bookId="book-1" />
        </SWRConfig>
      </MantineProvider>,
    );

    await selectFile();
    expect(screen.getByText("book.pdf")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Simulate background Source update" }),
    );

    // The lookup's data did change (a real, later "Select Another PDF" or
    // reopen would now see it) -- what must not happen is the active
    // workflow being replaced by it while this modal session is still open.
    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(screen.queryByLabelText("Source text")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select Another PDF" }),
    ).not.toBeInTheDocument();
  });

  describe("Select Another PDF (removes the saved Source)", () => {
    it("confirms before removing -- Select Another PDF does not DELETE immediately (ANA-75)", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Select Another PDF" }),
      );

      expect(
        await screen.findByRole("dialog", { name: "Remove attached source?" }),
      ).toBeInTheDocument();
      expect(deleteSourceMock).not.toHaveBeenCalled();
    });

    it("canceling the confirmation performs no mutation and keeps the workspace open (ANA-75)", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Select Another PDF" }),
      );
      await screen.findByRole("dialog", { name: "Remove attached source?" });
      fireEvent.click(screen.getByRole("button", { name: "Keep source" }));

      expect(
        screen.queryByRole("dialog", { name: "Remove attached source?" }),
      ).not.toBeInTheDocument();
      expect(deleteSourceMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Source text")).toBeInTheDocument();
    });

    it("calls DELETE /api/v1/sources/{sourceId} and returns to the upload flow once Remove source is confirmed", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

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
        screen.getByRole("button", { name: "Select Another PDF" }),
      );
      await screen.findByRole("dialog", { name: "Remove attached source?" });
      fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

      expect(
        await screen.findByRole("button", { name: "Choose a PDF to import" }),
      ).toBeInTheDocument();
      expect(deleteSourceMock).toHaveBeenCalledWith("source-1");
    });

    it("keeps the saved workspace visible and shows an error when deletion fails", async () => {
      mockExistingSource();
      deleteSourceMock.mockRejectedValueOnce(new Error("Cannot delete."));
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Select Another PDF" }),
      );
      await screen.findByRole("dialog", { name: "Remove attached source?" });
      fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

      expect(await screen.findByText("Cannot delete.")).toBeInTheDocument();
      expect(screen.getByLabelText("Source text")).toHaveValue("Saved text");
    });

    it("does not touch Modules or Materials when removing a Source", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(
        screen.getByRole("button", { name: "Select Another PDF" }),
      );
      await screen.findByRole("dialog", { name: "Remove attached source?" });
      fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

      await vi.waitFor(() => expect(deleteSourceMock).toHaveBeenCalled());
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createMaterialMock).not.toHaveBeenCalled();
      expect(updateMaterialMock).not.toHaveBeenCalled();
    });
  });

  describe("Save Changes (saved-Source workspace, ANA-72)", () => {
    it("loads existing Modules in Book order, each with its Learning Material, and shows an empty editor when a Module has none yet", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }, { id: "module-2" }],
        materials: [
          {
            id: "material-1",
            moduleId: "module-1",
            content: { ar: "Module 1 md", en: "" },
          },
        ],
      });
      renderModal();

      await screen.findByLabelText("Source text");
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();
      await screen.findByText("Module 1 md");

      const editors = await findMaterialEditors();
      expect(editors).toHaveLength(2);
      expect(editors[1]).toHaveTextContent("");
    });

    it("PATCHes the Source only when its content actually changed", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(deleteSourceMock).not.toHaveBeenCalled());
      expect(updateSourceMock).not.toHaveBeenCalled();
    });

    it("calls updateSource with the edited text when Save changes is clicked", async () => {
      mockExistingSource();
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(updateSourceMock).toHaveBeenCalledWith(
          "source-1",
          "Edited text",
        ),
      );
    });

    it("closes the modal once the save succeeds", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("refreshes the Edit Book Modules list once the save succeeds", async () => {
      mockExistingSource();
      const onModulesCreated = vi.fn();
      renderModal({ onModulesCreated });
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(onModulesCreated).toHaveBeenCalledTimes(1));
    });

    it("keeps the edited text visible and shows an error when saving the Source fails", async () => {
      mockExistingSource();
      updateSourceMock.mockRejectedValueOnce(new Error("Cannot save."));
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Cannot save.")).toBeInTheDocument();
      expect(screen.getByLabelText("Source text")).toHaveValue("Edited text");
    });

    it("PATCHes an existing Module's Material when its content changed", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }],
        materials: [
          {
            id: "material-1",
            moduleId: "module-1",
            content: { ar: "Original", en: "" },
          },
        ],
      });
      renderModal();
      await screen.findByLabelText("Source text");
      const [editable] = await findMaterialEditors();
      const user = userEvent.setup();
      await user.click(editable);
      await user.type(editable, "!");

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(updateMaterialMock).toHaveBeenCalledWith("material-1", {
          ar: "Original!",
          en: "",
        }),
      );
      expect(createMaterialMock).not.toHaveBeenCalled();
    });

    it("does not PATCH or create a Material for an existing Module whose content didn't change", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }],
        materials: [
          {
            id: "material-1",
            moduleId: "module-1",
            content: { ar: "Original", en: "" },
          },
        ],
      });
      renderModal();
      await screen.findByLabelText("Source text");
      await screen.findByText("Original");

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(deleteSourceMock).not.toHaveBeenCalled());
      expect(updateMaterialMock).not.toHaveBeenCalled();
      expect(createMaterialMock).not.toHaveBeenCalled();
    });

    it("creates a new Module then its Material, using the Module's real returned id, when Save Changes is clicked", async () => {
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (1)")).toBeInTheDocument();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-1", {
          ar: "Some",
          en: "",
        }),
      );
      expect(createModuleMock).toHaveBeenCalledWith("book-1", {
        title: { ar: "", en: "" },
        description: { ar: "", en: "" },
        color: "",
        isLocked: false,
        isPublished: false,
      });
    });

    it("retrying after a partial failure does not duplicate an already-created Module or Material", async () => {
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;
      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createMaterialMock.mockRejectedValueOnce(new Error("Network error"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createModuleMock).toHaveBeenCalledTimes(1);

      createModuleMock.mockClear();
      createMaterialMock.mockClear();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-1",
        bookId: "book-1",
        moduleId: "created-1",
        content: { ar: "Some", en: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(1),
      );
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-1", {
        ar: "Some",
        en: "",
      });
    });

    it("does not re-POST an already-succeeded new Module's Material -- across two new Modules, only the one that actually failed is retried (PR review, blocking)", async () => {
      // Owner review (blocking): before this fix, an already-succeeded new
      // Module's Material was tracked only by a one-shot
      // "materialized" flag keyed off its *temporary* id, entirely
      // separate from the `materialDocIdByModuleId`/
      // `savedMaterialContentByModuleId` bookkeeping every other write
      // path uses -- so any edit made to it *after* success (while the
      // modal stays open for an unrelated later failure) could never be
      // detected or PATCHed on a subsequent Save Changes click. The fix
      // instead promotes a newly created entry (`moduleId` set, and
      // registered in the same maps an originally-persisted Module uses)
      // the moment its Material succeeds, so it's indistinguishable from
      // an existing Module for every later Save Changes attempt --
      // covered end-to-end for an actual content edit by "PATCHes an
      // existing Module's Material when its content changed" above, since
      // a promoted entry now goes through that exact same code path.
      //
      // A literal "type new content into a Module's Learning Material
      // immediately after creating it" step can't be driven through the
      // DOM here: jsdom's Selection/Range implementation can't place a
      // cursor in a genuinely empty Lexical document (see
      // components/ui/markdown-editor.test.tsx and every other test in
      // this file that types into a Learning Material editor -- they all
      // start from non-empty seed content for the same reason), and a
      // newly created Module's Learning Material is always empty until
      // Save Changes has already round-tripped it once. This instead
      // verifies the property that *is* driveable end-to-end: once
      // Module A's Material has succeeded, a later failure elsewhere in
      // the same attempt must not cause a retry to re-POST A's Module or
      // Material -- only B's, the one that actually never succeeded.
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      textarea.setSelectionRange(5, 11);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();

      createModuleMock
        .mockResolvedValueOnce(moduleFixture("created-A"))
        .mockResolvedValueOnce(moduleFixture("created-B"));
      createMaterialMock
        .mockResolvedValueOnce({
          id: "material-A",
          bookId: "book-1",
          moduleId: "created-A",
          content: { ar: "Some", en: "" },
        })
        .mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createMaterialMock).toHaveBeenCalledTimes(2);
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        1,
        "book-1",
        "created-A",
        { ar: "Some", en: "" },
      );

      createModuleMock.mockClear();
      createMaterialMock.mockClear();
      updateMaterialMock.mockClear();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-B",
        bookId: "book-1",
        moduleId: "created-B",
        content: { ar: "source", en: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(1),
      );
      // Neither Module is re-created (both already exist from the first
      // attempt), A's already-succeeded Material is neither re-POSTed nor
      // PATCHed (it didn't change), and only B's still-missing Material is
      // created.
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(updateMaterialMock).not.toHaveBeenCalled();
      expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-B", {
        ar: "source",
        en: "",
      });
    });

    it("does not orphan an already-persisted Module through a local-only delete when its own Material POST fails in the same Save Changes attempt (PR review, blocking)", async () => {
      // Owner review (blocking): a new workspace entry's `moduleId` used to
      // stay `null` until its Material POST *also* succeeded -- so if the
      // Module POST succeeded but the Material POST then failed, the
      // now-editable-again card still looked "unsaved" (`moduleId: null`)
      // to SavedSourceView's delete decision. Deleting it at that point
      // removed it from the workspace locally, with no DELETE request,
      // silently orphaning the Module that already exists under the Book.
      // The fix promotes `moduleId` the instant the Module POST succeeds
      // (see handleSaveWorkspace's step 3), before its Material is even
      // attempted -- this drives that exact sequence end-to-end and
      // asserts Delete goes through the real Module DELETE API instead.
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (1)")).toBeInTheDocument();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createMaterialMock.mockRejectedValueOnce(new Error("Network error"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createModuleMock).toHaveBeenCalledTimes(1);

      // The Module was created before its own Material failed -- deleting
      // this card now must call the Module DELETE API, never remove it
      // locally.
      deleteModuleMock.mockResolvedValueOnce(undefined);
      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() =>
        expect(deleteModuleMock).toHaveBeenCalledWith("book-1", "created-1"),
      );
      await vi.waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "Module 1" }),
        ).not.toBeInTheDocument(),
      );
    });

    it("retrying after a partial failure still PATCHes a further edit to an already-succeeded new Module's Material, instead of silently dropping it (PR review, blocking)", async () => {
      // Regression test for the owner's second re-review (blocking):
      // step 2's earlier fix excluded every `createdModuleKeys` entry
      // outright, which also wrongly excluded an entry from a *previous*
      // attempt whose Module+Material had already succeeded -- so once
      // Module A's Material succeeded, it could never be PATCHed again on
      // any later retry, silently dropping a real edit made to it. This
      // drives: A's Module+Material succeed, B's Material fails, the user
      // edits A's already-persisted Material, then retries -- A must be
      // PATCHed with the edit, B's still-missing Material must be created,
      // and neither Module is re-created.
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      textarea.setSelectionRange(5, 11);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();

      createModuleMock
        .mockResolvedValueOnce(moduleFixture("created-A"))
        .mockResolvedValueOnce(moduleFixture("created-B"));
      createMaterialMock
        .mockResolvedValueOnce({
          id: "material-A",
          bookId: "book-1",
          moduleId: "created-A",
          content: { ar: "Some", en: "" },
        })
        .mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();

      // Edit Module A's now-persisted Learning Material before retrying --
      // its draft is non-empty ("Some", seeded from the Source Text
      // selection), so jsdom can place a cursor in it, unlike a genuinely
      // empty Lexical document (see the other tests in this file for the
      // same constraint).
      // The Markdown editor is loaded via `next/dynamic({ ssr: false })`
      // and mounts asynchronously -- wait for both cards' toolbars before
      // indexing into `findMaterialEditors()`'s result, since `findAllByRole`
      // itself resolves as soon as *any* match exists (the Source Text
      // `<textarea>` always has `role="textbox"`), not once every expected
      // editor has actually mounted.
      await vi.waitFor(async () =>
        expect(await screen.findAllByRole("toolbar")).toHaveLength(2),
      );
      const editors = await findMaterialEditors();
      const user = userEvent.setup();
      await user.click(editors[0]);
      await user.type(editors[0], "!");
      expect(await screen.findByText("Some!")).toBeInTheDocument();

      createModuleMock.mockClear();
      createMaterialMock.mockClear();
      updateMaterialMock.mockClear();
      updateMaterialMock.mockResolvedValueOnce({
        id: "material-A",
        bookId: "book-1",
        moduleId: "created-A",
        content: { ar: "Some!", en: "" },
      });
      createMaterialMock.mockResolvedValueOnce({
        id: "material-B",
        bookId: "book-1",
        moduleId: "created-B",
        content: { ar: "source", en: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(updateMaterialMock).toHaveBeenCalledWith("material-A", {
          ar: "Some!",
          en: "",
        }),
      );
      expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-B", {
        ar: "source",
        en: "",
      });
      expect(createModuleMock).not.toHaveBeenCalled();
    });

    it("sends the selected Source text as the new Module's Material, never as part of the Module's own draft payload (PR review)", async () => {
      // The selection seeds the Module's Learning Material draft (a
      // convenience, not a persisted Source->Module reference) -- so it
      // must flow to createMaterial's `content` argument, never appear in
      // createModule's own draft payload.
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;
      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-1", {
          ar: "Some",
          en: "",
        }),
      );
      for (const call of createModuleMock.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("Some");
      }
    });

    it("creates multiple new Modules in the order they were added, then each one's Material with the matching real id and its own selected text", async () => {
      mockExistingSource({ content: "Some source text" });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      textarea.setSelectionRange(5, 11);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();

      createModuleMock
        .mockResolvedValueOnce(moduleFixture("created-1"))
        .mockResolvedValueOnce(moduleFixture("created-2"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(2),
      );
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        1,
        "book-1",
        "created-1",
        { ar: "Some", en: "" },
      );
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        2,
        "book-1",
        "created-2",
        { ar: "source", en: "" },
      );
    });
  });

  describe("Persisting Module order on Save changes (ANA-79)", () => {
    // Same technique as saved-source-view.test.tsx's own reorder tests --
    // dnd-kit's keyboard coordinate math needs real-ish rects, keyed by the
    // shared SourceModulesPanel's testid scheme.
    function stubItemRects(order: string[], itemHeight = 60) {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const container = this.closest('[data-testid^="module-card-"]');
          const id = container
            ?.getAttribute("data-testid")
            ?.replace("module-card-", "");
          const index = id ? order.indexOf(id) : -1;
          const top = index === -1 ? 0 : index * itemHeight;
          return {
            top,
            bottom: top + itemHeight,
            left: 0,
            right: 300,
            width: 300,
            height: itemHeight,
            x: 0,
            y: top,
            toJSON() {},
          } as DOMRect;
        },
      );
    }

    // The spy above is created fresh per test, on the shared
    // `Element.prototype` -- restore it after each test so the mocked
    // geometry can't leak into unrelated tests in this file (Copilot
    // review).
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function dragFirstCardDown() {
      const card = screen.getByTestId("module-card-module-1");
      const handle = card.querySelector('span[role="button"]') as HTMLElement;
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
      fireEvent.keyDown(handle, { code: "Space", key: " " });
    }

    it("persists the dragged order for already-persisted Modules, and no other Modules writes", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }, { id: "module-2" }],
      });
      renderModal();
      await screen.findByLabelText("Source text");
      stubItemRects(["module-1", "module-2"]);

      await dragFirstCardDown();
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(reorderModulesMock).toHaveBeenCalledWith("book-1", [
          "module-2",
          "module-1",
        ]),
      );
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createMaterialMock).not.toHaveBeenCalled();
    });

    it("does not send a reorder PATCH when the displayed order was never changed", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }, { id: "module-2" }],
      });
      renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(deleteSourceMock).not.toHaveBeenCalled());
      expect(reorderModulesMock).not.toHaveBeenCalled();
    });

    it("resolves a new (temporary) Module's real id before persisting the final order, appended after an existing Module", async () => {
      // No drag needed to exercise id resolution here: the new temporary
      // Module extends the displayed order past what was last persisted
      // (`savedWorkspaceModuleOrder`, seeded from the one existing Module),
      // so Save changes must still send a reorder PATCH -- with the new
      // Module's *real*, server-returned id, not its temporary client key.
      mockExistingSource({
        modules: [{ id: "module-1" }],
        content: "Some source text",
      });
      renderModal();
      const textarea = (await screen.findByLabelText(
        "Source text",
      )) as HTMLTextAreaElement;
      textarea.setSelectionRange(0, 4);
      fireEvent.select(textarea);
      fireEvent.click(screen.getByRole("button", { name: "Create Module" }));
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(reorderModulesMock).toHaveBeenCalledWith("book-1", [
          "module-1",
          "created-1",
        ]),
      );
    });

    it("keeps the modal open, preserves the chosen order, and does not duplicate already-succeeded writes when the reorder PATCH itself fails; a retry succeeds", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }, { id: "module-2" }],
      });
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");
      stubItemRects(["module-1", "module-2"]);
      await dragFirstCardDown();

      reorderModulesMock.mockRejectedValueOnce(
        new Error("`modules` must be a reorder of the exact current set."),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(
        await screen.findByText(
          "`modules` must be a reorder of the exact current set.",
        ),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      // The dragged order is still what's displayed -- Module 2's card is
      // now first.
      const cardsAfterFailure = screen.getAllByTestId(
        /^module-card-(?!overlay-)/,
      );
      expect(cardsAfterFailure[0]).toHaveAttribute(
        "data-testid",
        "module-card-module-2",
      );

      reorderModulesMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(reorderModulesMock).toHaveBeenCalledWith("book-1", [
        "module-2",
        "module-1",
      ]);
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

    // A PDF has been selected, so this close is guarded by the discard
    // confirmation (ANA-75) -- Escape opens it instead of closing directly.
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Discard changes" }),
    );

    // Discarding resets state immediately (resetState() runs before
    // onClose), so the dialog's own content already reflects the picker
    // again while Mantine's exit transition is still fading it out.
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

    // A reviewed OCR result exists, so this confirms first (ANA-75) --
    // Confirming preserves the selected PDF and the page-selection choices.
    fireEvent.click(
      await screen.findByRole("button", { name: "Return to page selection" }),
    );

    expect(screen.getByText("book.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select page 1" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("canceling Back to page selection keeps the reviewed OCR result in place (ANA-75)", async () => {
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
    await screen.findByRole("button", { name: "Create Modules" });

    fireEvent.click(
      screen.getByRole("button", { name: "Back to page selection" }),
    );
    await screen.findByRole("dialog", { name: "Return to page selection?" });
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(
      screen.queryByRole("dialog", { name: "Return to page selection?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Extracted text for page 1")).toHaveValue(
      "# Hello",
    );
  });

  it("Create Modules advances to the Module builder using edited OCR Markdown, with Finish already available", async () => {
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
    // The Module builder is now the flow's final editing screen (ANA-75) --
    // there is no separate "Create Learning Material" step to advance to,
    // and Finish is available immediately, even before any Module exists.
    expect(
      screen.queryByRole("button", { name: "Create Learning Material" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
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

    // Back to review, back to page selection (confirming the discard,
    // ANA-75), choose a different file.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Back to page selection" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Return to page selection" }),
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

  // Reaches the Module builder -- now the flow's final editing screen
  // (ANA-75) -- with two temporary Modules, built (in order) from "Some "
  // and "source" of the single OCR page's text. Used by the Finish tests
  // below to exercise ordering across more than one Module.
  async function reachBuildModulesWithTwoModules() {
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
  }

  it("does not render or navigate to a separate Learning Material step -- the Module builder is the final Create-from-PDF screen (ANA-75)", async () => {
    await reachBuildModulesWithOneModule();

    expect(
      screen.queryByRole("button", { name: "Create Learning Material" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Modules" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
    expect(screen.getByText("Modules (1)")).toBeInTheDocument();
  });

  describe("Finish", () => {
    it("is enabled even with zero temporary Modules", async () => {
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

      expect(screen.getByText("Modules")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    });

    it("finishing with zero temporary Modules persists the reviewed Source without creating any Module or Material", async () => {
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
      const { onClose } = renderModal();
      await selectFile();
      fireEvent.click(screen.getByRole("checkbox", { name: "Select page 1" }));
      fireEvent.click(screen.getByRole("button", { name: /Run OCR/ }));
      await screen.findByRole("button", { name: "Create Modules" });
      fireEvent.click(screen.getByRole("button", { name: "Create Modules" }));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createSourceMock).toHaveBeenCalledWith(
          "book-1",
          "Some source text",
        ),
      );
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createMaterialMock).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("POSTs one Module per temporary Module, in order, with the exact draft payload", async () => {
      await reachBuildModulesWithTwoModules();

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

      createModuleMock.mockRejectedValueOnce(new Error("Server exploded"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Server exploded")).toBeInTheDocument();
      expect(screen.getByText("book.pdf")).toBeInTheDocument();
    });

    it("disables Back once a Module has already been created, after a partial failure", async () => {
      // PR review (ANA-70, blocking): a Module created before a later
      // failure in the same Finish run already exists under the Book and
      // can't be rolled back from here -- Back must stay disabled so the
      // reviewed OCR result (and this Module list) can't be discarded out
      // from under it. Retrying Finish is the only way forward.
      await reachBuildModulesWithTwoModules();

      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createModuleMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      await screen.findByText("Network error");

      const backButton = screen.getByRole("button", { name: "Back" });
      expect(backButton).toBeDisabled();
      expect(screen.getByText("Modules (2)")).toBeInTheDocument();
    });

    it("retrying after a partial failure does not recreate Modules that already succeeded", async () => {
      await reachBuildModulesWithTwoModules();

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

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() => expect(onModulesCreated).toHaveBeenCalledTimes(1));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("persists the Source with the Book id and the full reviewed OCR text once every Module is created", async () => {
      await reachBuildModulesWithTwoModules();

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createSourceMock).toHaveBeenCalledWith(
          "book-1",
          "Some source text",
        ),
      );
    });

    it("does not create the Source before every Module has been created", async () => {
      await reachBuildModulesWithTwoModules();
      createModuleMock.mockResolvedValueOnce(moduleFixture("created-1"));
      createModuleMock.mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createSourceMock).not.toHaveBeenCalled();
    });

    it("persists one Material per Module using the real persisted moduleId (never the temporary id), each with the full bilingual draft seeded from its Source Text selection", async () => {
      await reachBuildModulesWithTwoModules();

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(2),
      );
      // The Module builder seeds each Module's Arabic draft directly from
      // its Source Text selection (ANA-75) -- "Some " and "source" here,
      // matching reachBuildModulesWithTwoModules' selectSourceRange calls --
      // leaving English empty, with no separate Learning Material step to
      // pass through first.
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        1,
        "book-1",
        "created-1",
        { ar: "Some ", en: "" },
      );
      expect(createMaterialMock).toHaveBeenNthCalledWith(
        2,
        "book-1",
        "created-2",
        { ar: "source", en: "" },
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
      await reachBuildModulesWithTwoModules();
      createSourceMock.mockRejectedValueOnce(new Error("Storage error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(await screen.findByText("Storage error")).toBeInTheDocument();
      expect(createMaterialMock).not.toHaveBeenCalled();
    });

    it("retrying after a Material failure does not recreate the Modules or the Source, and skips the Material that already succeeded", async () => {
      await reachBuildModulesWithTwoModules();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-1",
        bookId: "book-1",
        moduleId: "created-1",
        content: { ar: "Some ", en: "" },
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
        content: { ar: "source", en: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(createMaterialMock).toHaveBeenCalledTimes(1),
      );
      expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-2", {
        ar: "source",
        en: "",
      });
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createSourceMock).not.toHaveBeenCalled();
    });

    it("retrying after a partial Material failure PATCHes an edit made to an already-succeeded Module's Learning Material, instead of silently dropping it (PR review, blocking)", async () => {
      // Reproduces: A's Module/Material succeed, B's Material fails, the
      // modal stays open and editable again, the user edits A's Learning
      // Material, then retries -- A must be PATCHed with the new content,
      // not skipped outright because it was already "materialized" once.
      await reachBuildModulesWithTwoModules();
      createModuleMock
        .mockResolvedValueOnce(moduleFixture("created-1"))
        .mockResolvedValueOnce(moduleFixture("created-2"));
      createMaterialMock
        .mockResolvedValueOnce({
          id: "material-1",
          bookId: "book-1",
          moduleId: "created-1",
          content: { ar: "Some ", en: "" },
        })
        .mockRejectedValueOnce(new Error("Network error"));

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(await screen.findByText("Network error")).toBeInTheDocument();
      expect(createMaterialMock).toHaveBeenCalledTimes(2);

      // The modal stays open and editable after the partial failure --
      // edit Module A's (already-succeeded) Learning Material.
      const editors = await findMaterialEditors();
      const user = userEvent.setup();
      await user.click(editors[0]);
      await user.type(editors[0], "!");

      createModuleMock.mockClear();
      createSourceMock.mockClear();
      createMaterialMock.mockClear();
      createMaterialMock.mockResolvedValueOnce({
        id: "material-2",
        bookId: "book-1",
        moduleId: "created-2",
        content: { ar: "source", en: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      await vi.waitFor(() =>
        expect(updateMaterialMock).toHaveBeenCalledTimes(1),
      );
      // MDXEditor trims the seeded trailing space from "Some " once it
      // round-trips through the editor (typing into it re-serializes the
      // Markdown) -- "Some!" is the genuine post-edit value, not "Some !".
      expect(updateMaterialMock).toHaveBeenCalledWith("material-1", {
        ar: "Some!",
        en: "",
      });
      // B's still-missing Material is created (never re-created for A), and
      // neither Module nor the Source is duplicated.
      expect(createMaterialMock).toHaveBeenCalledTimes(1);
      expect(createMaterialMock).toHaveBeenCalledWith("book-1", "created-2", {
        ar: "source",
        en: "",
      });
      expect(createModuleMock).not.toHaveBeenCalled();
      expect(createSourceMock).not.toHaveBeenCalled();
    });
  });

  describe("Dirty state and close guard (ANA-75)", () => {
    it("closes immediately, without confirmation, when the untouched initial PDF picker is closed", async () => {
      const { onClose } = renderModal();
      await screen.findByRole("button", { name: "Choose a PDF to import" });

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes immediately, without confirmation, when the clean saved-Source workspace is closed", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("blocks closing a dirty saved-Source workspace and offers Discard changes / Keep editing", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Your changes have not been saved and will be lost."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("blocks closing after a reorder-only change (no content/Material edit), and Save changes clears it (ANA-79, PR review)", async () => {
      mockExistingSource({
        modules: [{ id: "module-1" }, { id: "module-2" }],
      });
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      const restoreRects = vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          const container = this.closest('[data-testid^="module-card-"]');
          const id = container
            ?.getAttribute("data-testid")
            ?.replace("module-card-", "");
          const order = ["module-1", "module-2"];
          const index = id ? order.indexOf(id) : -1;
          const top = index === -1 ? 0 : index * 60;
          return {
            top,
            bottom: top + 60,
            left: 0,
            right: 300,
            width: 300,
            height: 60,
            x: 0,
            y: top,
            toJSON() {},
          } as DOMRect;
        });
      const card = screen.getByTestId("module-card-module-1");
      const handle = card.querySelector('span[role="button"]') as HTMLElement;
      handle.focus();
      fireEvent.keyDown(handle, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
      fireEvent.keyDown(handle, { code: "Space", key: " " });

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      restoreRects.mockRestore();
    });

    it("does not treat an already-persisted Delete as an unsaved reorder -- the close guard stays clear (ANA-79, PR review)", async () => {
      let currentModuleIds = ["module-1", "module-2"];
      (fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
        const url = String(input);

        if (url.startsWith("/api/v1/sources?bookId=")) {
          return Promise.resolve(
            jsonResponse({
              data: [
                { id: "source-1", bookId: "book-1", content: "Saved text" },
              ],
            }),
          );
        }
        if (url === "/api/v1/books/book-1/modules") {
          return Promise.resolve(
            jsonResponse({
              data: currentModuleIds.map((id) => moduleFixture(id)),
            }),
          );
        }
        if (url.startsWith("/api/v1/materials?bookId=")) {
          return Promise.resolve(jsonResponse({ data: [] }));
        }
        throw new Error(`Unhandled fetch in test: ${url}`);
      });
      deleteModuleMock.mockImplementationOnce(async () => {
        currentModuleIds = currentModuleIds.filter((id) => id !== "module-1");
      });

      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.click(screen.getByRole("button", { name: "Delete Module 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

      await vi.waitFor(() =>
        expect(deleteModuleMock).toHaveBeenCalledWith("book-1", "module-1"),
      );
      await vi.waitFor(() =>
        expect(screen.getByText("Modules (1)")).toBeInTheDocument(),
      );

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Keep editing closes only the confirmation and preserves the edited workspace", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Source text")).toHaveValue("Edited text");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("Discard changes resets the modal session and closes it", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("a successful Save changes clears the dirty state, so closing right after does not warn", async () => {
      mockExistingSource();
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("blocks closing once a Create-from-PDF workflow has started (a PDF was selected)", async () => {
      const { onClose } = renderModal();
      await selectFile();

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        await screen.findByRole("dialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not allow closing/discarding to race an in-flight Save request", async () => {
      mockExistingSource();
      let resolveUpdate: (value: unknown) => void = () => {};
      updateSourceMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      const { onClose } = renderModal();
      await screen.findByLabelText("Source text");

      fireEvent.change(screen.getByLabelText("Source text"), {
        target: { value: "Edited text" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      // The in-flight save blocks the close attempt entirely -- neither the
      // discard confirmation nor onClose fires while it's still pending.
      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      resolveUpdate({
        id: "source-1",
        bookId: "book-1",
        content: "Edited text",
      });
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });
});
