import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

const { useRouterMock, useParamsMock, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  return {
    useRouterMock: vi.fn(() => ({ push: pushMock })),
    useParamsMock: vi.fn(),
    pushMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
  useParams: useParamsMock,
}));

import { buildBookFixture } from "../../book-fixtures";
import EditBookPage from "./page";
import type { Module } from "@/lib/modules/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildModuleFixture(overrides: Partial<Module> = {}): Module {
  return {
    id: "module-1",
    title: { ar: "", en: "" },
    description: { ar: "", en: "" },
    color: "",
    lessons: [],
    isLocked: false,
    isPublished: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedBy: "admin@example.com",
    ...overrides,
  };
}

/** Routes the globally-stubbed `fetch` by method + URL, matching every real
 * request this page makes: `GET` the Book, `GET` its Modules (only once the
 * Book has loaded -- see page.tsx's conditional SWR key), and optionally
 * `PATCH` the Book on save. */
function setupFetch(
  book: ReturnType<typeof buildBookFixture> | null,
  options: {
    bookStatus?: number;
    modules?: Module[];
    onPatch?: (body: unknown) => { status: number; body: unknown };
  } = {},
) {
  const { bookStatus = 200, modules = [], onPatch } = options;

  (fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url === "/api/v1/books/book-1") {
        return Promise.resolve(
          book
            ? jsonResponse({ data: book }, bookStatus)
            : jsonResponse({ error: "Book not found." }, bookStatus),
        );
      }

      if (method === "GET" && url === "/api/v1/books/book-1/modules") {
        return Promise.resolve(jsonResponse({ data: modules }));
      }

      // ANA-71: the Import Source modal looks up a saved Source for the
      // Book as soon as it's opened -- every test that opens it needs this
      // handled, and no test in this file exercises a saved Source, so it
      // always reports none.
      if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
        return Promise.resolve(jsonResponse({ data: [] }));
      }

      if (method === "PATCH" && url === "/api/v1/books/book-1" && onPatch) {
        const { status, body } = onPatch(JSON.parse(init?.body as string));
        return Promise.resolve(jsonResponse(body, status));
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    },
  );
}

function renderPage() {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak fixture data across test cases keyed by the same URL. */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EditBookPage />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("EditBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    useParamsMock.mockReturnValue({ id: "book-1" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads with GET /api/v1/books/{bookId}", () => {
    setupFetch(buildBookFixture());
    renderPage();

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1");
  });

  it("has no Cancel button", async () => {
    setupFetch(buildBookFixture());
    renderPage();
    await screen.findByRole("button", { name: "Save changes" });

    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("initializes every Book field correctly, including longDescription", async () => {
    setupFetch(
      buildBookFixture({ longDescription: { ar: "# طويل", en: "# Long" } }),
    );
    renderPage();

    expect(
      await screen.findByDisplayValue("الرحيق المختوم"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toHaveValue(
      "sealed-nectar",
    );
    expect(screen.getByRole("switch", { name: "Published" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      await screen.findByRole("heading", { name: "طويل" }),
    ).toBeInTheDocument();
  });

  it("renders Create from PDF immediately next to Save changes in the header, both enabled once loaded", async () => {
    setupFetch(buildBookFixture());
    renderPage();

    const saveChanges = await screen.findByRole("button", {
      name: "Save changes",
    });
    const importSource = screen.getByRole("button", {
      name: "Create from PDF",
    });
    expect(importSource).toBeEnabled();
    expect(saveChanges).toBeEnabled();

    // "Immediately next to" -- adjacent header buttons in the same action
    // group, not separated by unrelated content.
    expect(importSource.nextElementSibling).toBe(saveChanges);
  });

  it("renders the Modules panel on the right, enabled", async () => {
    setupFetch(buildBookFixture());
    renderPage();

    await screen.findByRole("button", { name: "Save changes" });
    expect(await screen.findByText("Modules")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Add module" }),
    ).toBeEnabled();
  });

  it("opens the Import Source modal, starting at the PDF picker", async () => {
    setupFetch(buildBookFixture());
    renderPage();

    const importSource = await screen.findByRole("button", {
      name: "Create from PDF",
    });

    expect(
      screen.queryByRole("dialog", { name: "Create from PDF" }),
    ).not.toBeInTheDocument();

    fireEvent.click(importSource);

    expect(
      await screen.findByRole("dialog", { name: "Create from PDF" }),
    ).toBeInTheDocument();
    // The modal's own Source-by-bookId lookup (ANA-71) resolves
    // asynchronously before the upload flow renders -- `findByRole` waits
    // for that instead of assuming the picker is already there.
    expect(
      await screen.findByRole("button", { name: "Choose a PDF to import" }),
    ).toBeInTheDocument();
  });

  it("sends PATCH /api/v1/books/{bookId} with the edited fields on save, without modules or audit fields", async () => {
    setupFetch(buildBookFixture(), {
      onPatch: (body) => ({
        status: 200,
        body: {
          data: buildBookFixture({
            ...(body as object),
            imageId: "updated-image",
          }),
        },
      }),
    });
    renderPage();

    await screen.findByRole("button", { name: "Save changes" });

    fireEvent.change(screen.getByLabelText("In-app image ID"), {
      target: { value: "updated-image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/admin/books"),
    );

    const patchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, init]) => init?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string);
    expect(body.imageId).toBe("updated-image");
    expect(body).not.toHaveProperty("modules");
    expect(body).not.toHaveProperty("createdAt");
    expect(body).not.toHaveProperty("updatedAt");
    expect(body).not.toHaveProperty("createdBy");
    expect(body).not.toHaveProperty("updatedBy");
  });

  it("stays on the form and surfaces the failure when saving fails", async () => {
    setupFetch(buildBookFixture(), {
      onPatch: () => ({
        status: 400,
        body: { error: "Something went wrong." },
      }),
    });
    renderPage();
    await screen.findByRole("button", { name: "Save changes" });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a not-found state for a 404, rather than falling back to mock data", async () => {
    setupFetch(null, { bookStatus: 404 });
    renderPage();

    expect(
      await screen.findByText("This book could not be found."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("In-app image ID")).not.toBeInTheDocument();
  });

  describe("Modules", () => {
    it("loads Modules via GET /api/v1/books/{bookId}/modules, in the order returned", async () => {
      setupFetch(buildBookFixture(), {
        modules: [
          buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
        ],
      });
      renderPage();

      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1/modules"),
      );
      const items = await screen.findAllByText(/^[أب]$/);
      expect(items.map((el) => el.textContent)).toEqual(["أ", "ب"]);
    });

    it("labels each Module using its Arabic title, falling back to English, then Module N", async () => {
      setupFetch(buildBookFixture(), {
        modules: [
          buildModuleFixture({
            id: "module-1",
            title: { ar: "الوحدة الأولى", en: "First unit" },
          }),
          buildModuleFixture({
            id: "module-2",
            title: { ar: "", en: "Second unit" },
          }),
          buildModuleFixture({ id: "module-3", title: { ar: "", en: "" } }),
        ],
      });
      renderPage();

      expect(await screen.findByText("الوحدة الأولى")).toBeInTheDocument();
      expect(screen.getByText("Second unit")).toBeInTheDocument();
      expect(screen.getByText("Module 3")).toBeInTheDocument();
    });

    it("does not display the INITIAL_MOCK_MODULES fixture titles", async () => {
      setupFetch(buildBookFixture(), {
        modules: [buildModuleFixture({ title: { ar: "", en: "Real module" } })],
      });
      renderPage();

      expect(await screen.findByText("Real module")).toBeInTheDocument();
      expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
      expect(screen.queryByText("Prayer basics")).not.toBeInTheDocument();
      expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    });

    it("does not add a fake local Module when Add module is clicked", async () => {
      setupFetch(buildBookFixture(), { modules: [] });
      renderPage();

      await screen.findByText("This book has no modules yet.");
      const subtitleBefore = screen.getByText("0 modules");

      fireEvent.click(screen.getByRole("button", { name: "Add module" }));

      expect(subtitleBefore).toBeInTheDocument();
      expect(
        screen.queryByText("This book has no modules yet."),
      ).toBeInTheDocument();
    });
  });
});
