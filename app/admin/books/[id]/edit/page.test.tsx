import { fireEvent, render, screen, within } from "@testing-library/react";
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
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { Material } from "@/lib/materials/types";
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

function buildMaterialFixture(overrides: Partial<Material> = {}): Material {
  return {
    id: "material-1",
    bookId: "book-1",
    moduleId: "module-1",
    content: { ar: "", en: "" },
    ...overrides,
  };
}

/** Routes the globally-stubbed `fetch` by method + URL, matching every real
 * request this page makes: `GET` the Book, `GET` its Modules (only once the
 * Book has loaded -- see page.tsx's conditional SWR key), `GET` its
 * Materials (same conditional gating), the page's own Source-by-bookId
 * lookup (which drives the header button's label), optionally `PATCH` the
 * Book on save, and optionally `POST`/`PATCH`/`DELETE` a Module or a
 * Material (ANA-77/ANA-94). */
function setupFetch(
  book: ReturnType<typeof buildBookFixture> | null,
  options: {
    bookStatus?: number;
    modules?: Module[];
    materials?: Material[];
    /** Simulates a failed Materials lookup (ANA-94 PR review) -- e.g. 500. */
    materialsStatus?: number;
    hasSource?: boolean;
    onPatch?: (body: unknown) => { status: number; body: unknown };
    onCreateModule?: (body: unknown) => { status: number; body: unknown };
    onUpdateModule?: (
      moduleId: string,
      body: unknown,
    ) => { status: number; body: unknown };
    onDeleteModule?: (moduleId: string) => { status: number; body: unknown };
    onCreateMaterial?: (body: unknown) => { status: number; body: unknown };
    onUpdateMaterial?: (
      materialId: string,
      body: unknown,
    ) => { status: number; body: unknown };
  } = {},
) {
  const {
    bookStatus = 200,
    modules = [],
    materials = [],
    materialsStatus = 200,
    hasSource = false,
    onPatch,
    onCreateModule,
    onUpdateModule,
    onDeleteModule,
    onCreateMaterial,
    onUpdateMaterial,
  } = options;

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

      // ANA-71: both this page (for the header button's label) and the
      // Import Source modal (once opened) look up whether the Book already
      // has a saved Source -- no test in this file exercises one by
      // default, so it reports none unless `hasSource` is set.
      if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
        return Promise.resolve(
          jsonResponse({
            data: hasSource
              ? [{ id: "source-1", bookId: "book-1", content: "Saved text" }]
              : [],
          }),
        );
      }

      if (method === "PATCH" && url === "/api/v1/books/book-1" && onPatch) {
        const { status, body } = onPatch(JSON.parse(init?.body as string));
        return Promise.resolve(jsonResponse(body, status));
      }

      if (
        method === "POST" &&
        url === "/api/v1/books/book-1/modules" &&
        onCreateModule
      ) {
        const { status, body } = onCreateModule(
          JSON.parse(init?.body as string),
        );
        return Promise.resolve(jsonResponse(body, status));
      }

      const moduleMatch = /^\/api\/v1\/books\/book-1\/modules\/(.+)$/.exec(url);

      if (method === "PATCH" && moduleMatch && onUpdateModule) {
        const { status, body } = onUpdateModule(
          moduleMatch[1],
          JSON.parse(init?.body as string),
        );
        return Promise.resolve(jsonResponse(body, status));
      }

      if (method === "DELETE" && moduleMatch && onDeleteModule) {
        const { status, body } = onDeleteModule(moduleMatch[1]);
        return Promise.resolve(jsonResponse(body, status));
      }

      if (method === "GET" && url === "/api/v1/materials?bookId=book-1") {
        return Promise.resolve(
          materialsStatus === 200
            ? jsonResponse({ data: materials })
            : jsonResponse(
                { error: "Materials are unavailable." },
                materialsStatus,
              ),
        );
      }

      if (
        method === "POST" &&
        url === "/api/v1/materials" &&
        onCreateMaterial
      ) {
        const { status, body } = onCreateMaterial(
          JSON.parse(init?.body as string),
        );
        return Promise.resolve(jsonResponse(body, status));
      }

      const materialMatch = /^\/api\/v1\/materials\/(.+)$/.exec(url);

      if (method === "PATCH" && materialMatch && onUpdateMaterial) {
        const { status, body } = onUpdateMaterial(
          materialMatch[1],
          JSON.parse(init?.body as string),
        );
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

  it("renders Module Builder immediately next to Save changes in the header, both enabled once loaded", async () => {
    setupFetch(buildBookFixture());
    renderPage();

    const saveChanges = await screen.findByRole("button", {
      name: "Save changes",
    });
    const importSource = await screen.findByRole("button", {
      name: "Module Builder",
    });
    expect(importSource).toBeEnabled();
    expect(saveChanges).toBeEnabled();

    // "Immediately next to" -- adjacent header buttons in the same action
    // group, not separated by unrelated content.
    expect(importSource.nextElementSibling).toBe(saveChanges);
  });

  it("hides the Source action button until its own Source lookup resolves (ANA-75)", async () => {
    let resolveSources: (response: Response) => void = () => {};
    const sourcesPromise = new Promise<Response>((resolve) => {
      resolveSources = resolve;
    });
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url === "/api/v1/books/book-1") {
          return Promise.resolve(jsonResponse({ data: buildBookFixture() }));
        }
        if (method === "GET" && url === "/api/v1/books/book-1/modules") {
          return Promise.resolve(jsonResponse({ data: [] }));
        }
        if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
          return sourcesPromise;
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      },
    );
    renderPage();

    // The Book itself (and the always-present Save changes button) load
    // independently of the Source lookup, which is still pending here.
    await screen.findByRole("button", { name: "Save changes" });
    expect(
      screen.queryByRole("button", { name: "Module Builder" }),
    ).not.toBeInTheDocument();

    resolveSources(jsonResponse({ data: [] }));

    expect(
      await screen.findByRole("button", { name: "Module Builder" }),
    ).toBeInTheDocument();
  });

  it("keeps the Source action button hidden if the Source lookup fails, instead of guessing Module Builder (ANA-75)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url === "/api/v1/books/book-1") {
          return Promise.resolve(jsonResponse({ data: buildBookFixture() }));
        }
        if (method === "GET" && url === "/api/v1/books/book-1/modules") {
          return Promise.resolve(jsonResponse({ data: [] }));
        }
        if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
          return Promise.resolve(
            jsonResponse({ error: "Sources are unavailable." }, 500),
          );
        }
        throw new Error(`Unhandled fetch: ${method} ${url}`);
      },
    );
    renderPage();

    await screen.findByRole("button", { name: "Save changes" });
    // Lets the failed Source lookup's rejection propagate into SWR's error
    // state -- there's no visible error banner at this page level to
    // `findBy` on instead (see module-list.test.tsx for the same pattern).
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByRole("button", { name: "Module Builder" }),
    ).not.toBeInTheDocument();
  });

  it("labels the header button Module Builder whether or not the Book already has a saved Source", async () => {
    setupFetch(buildBookFixture(), { hasSource: true });
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Module Builder" }),
    ).toBeInTheDocument();
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
      name: "Module Builder",
    });

    expect(
      screen.queryByRole("dialog", { name: "Module Builder" }),
    ).not.toBeInTheDocument();

    fireEvent.click(importSource);

    expect(
      await screen.findByRole("dialog", { name: "Module Builder" }),
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

    it("opens the Add Module modal instead of inserting a blank Module directly (ANA-94)", async () => {
      setupFetch(buildBookFixture(), { modules: [] });
      renderPage();

      await screen.findByText("This book has no modules yet.");

      fireEvent.click(screen.getByRole("button", { name: "Add module" }));

      expect(
        await screen.findByRole("dialog", { name: "Add Module" }),
      ).toBeInTheDocument();
      // Nothing is added to the list merely by opening the modal -- only a
      // successful create does that (see the "Create Module" describe
      // below).
      expect(screen.getByText("0 modules")).toBeInTheDocument();
      expect(
        (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
          ([, init]) => init?.method === "POST",
        ),
      ).toBe(false);
    });

    describe("Reorder (ANA-79)", () => {
      // Same technique as modules-panel.test.tsx/item-list.test.tsx's own
      // keyboard-drag tests -- dnd-kit's keyboard coordinate math needs
      // real-ish rects, keyed by ItemList's own testid scheme.
      function stubItemRects(order: string[], itemHeight = 60) {
        const spy = vi
          .spyOn(Element.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: Element) {
            const container = this.closest('[data-testid^="list-item-"]');
            const id = container
              ?.getAttribute("data-testid")
              ?.replace("list-item-", "");
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
          });
        return spy;
      }

      afterEach(() => {
        vi.restoreAllMocks();
      });

      async function dragFirstModuleDown() {
        const grip = document.querySelector(
          '[data-testid="list-item-module-1"] [aria-hidden="true"]',
        ) as HTMLElement;
        grip.focus();
        fireEvent.keyDown(grip, { code: "Space", key: " " });
        await new Promise((resolve) => setTimeout(resolve, 0));
        fireEvent.keyDown(grip, { code: "ArrowDown", key: "ArrowDown" });
        fireEvent.keyDown(grip, { code: "Space", key: " " });
      }

      it("reorders locally with no network request, and keeps reordering freely", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
          ],
        });
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[أب]$/);
          expect(items.map((el) => el.textContent)).toEqual(["ب", "أ"]);
        });
        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, init]) => init?.method === "PATCH",
          ),
        ).toBe(false);

        // Not disabled/frozen by the reorder itself -- dragging again keeps
        // working (module-2 is now first, so this drags it back down).
        stubItemRects(["module-2", "module-1"]);
        const secondGrip = document.querySelector(
          '[data-testid="list-item-module-2"] [aria-hidden="true"]',
        ) as HTMLElement;
        secondGrip.focus();
        fireEvent.keyDown(secondGrip, { code: "Space", key: " " });
        await new Promise((resolve) => setTimeout(resolve, 0));
        fireEvent.keyDown(secondGrip, { code: "ArrowDown", key: "ArrowDown" });
        fireEvent.keyDown(secondGrip, { code: "Space", key: " " });

        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[أب]$/);
          expect(items.map((el) => el.textContent)).toEqual(["أ", "ب"]);
        });
      });

      it("includes the reordered Module ids in the same Book PATCH as the form's other fields, only when Save changes is clicked", async () => {
        let patchBody: Record<string, unknown> | null = null;
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
          ],
          onPatch: (body) => {
            patchBody = body as Record<string, unknown>;
            return { status: 200, body: { data: buildBookFixture() } };
          },
        });
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        // The reorder alone makes no request yet.
        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, init]) => init?.method === "PATCH",
          ),
        ).toBe(false);

        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        await vi.waitFor(() => expect(patchBody).not.toBeNull());
        expect(patchBody).toMatchObject({ modules: ["module-2", "module-1"] });
        // The rest of the form's fields are still sent in the same request.
        expect(patchBody).toHaveProperty("title");
      });

      it("keeps the reordered draft visible and shows the form's save error when the PATCH fails", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
          ],
          onPatch: () => ({
            status: 400,
            body: { error: "Something went wrong." },
          }),
        });
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        expect(
          await screen.findByText("Something went wrong."),
        ).toBeInTheDocument();
        // The dragged order is still what's displayed -- Save failing must
        // not discard the user's chosen order.
        const items = await screen.findAllByText(/^[أب]$/);
        expect(items.map((el) => el.textContent)).toEqual(["ب", "أ"]);
        expect(pushMock).not.toHaveBeenCalled();
      });

      it("revalidates the Modules list after a successful save that included a reorder", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
          ],
          onPatch: () => ({ status: 200, body: { data: buildBookFixture() } }),
        });
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        const modulesGetCallsBefore = (
          fetch as ReturnType<typeof vi.fn>
        ).mock.calls.filter(
          ([url, init]) =>
            String(url) === "/api/v1/books/book-1/modules" &&
            (init?.method ?? "GET") === "GET",
        ).length;

        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        await vi.waitFor(() =>
          expect(pushMock).toHaveBeenCalledWith("/admin/books"),
        );
        const modulesGetCallsAfter = (
          fetch as ReturnType<typeof vi.fn>
        ).mock.calls.filter(
          ([url, init]) =>
            String(url) === "/api/v1/books/book-1/modules" &&
            (init?.method ?? "GET") === "GET",
        ).length;
        expect(modulesGetCallsAfter).toBeGreaterThan(modulesGetCallsBefore);
      });

      it("opening Add Module doesn't touch the current Module order or count (ANA-94)", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));
        await screen.findByRole("dialog", { name: "Add Module" });

        expect(screen.getByText("أ")).toBeInTheDocument();
        expect(screen.getByText("1 module")).toBeInTheDocument();
        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, init]) => init?.method === "PATCH",
          ),
        ).toBe(false);
      });
    });

    describe("Module Builder order sync (ANA-84)", () => {
      // Same keyboard-drag technique as the Reorder (ANA-79) tests above,
      // for this page's own Modules panel (`list-item-<id>` testids).
      function stubItemRects(order: string[], itemHeight = 60) {
        return vi
          .spyOn(Element.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: Element) {
            const container = this.closest('[data-testid^="list-item-"]');
            const id = container
              ?.getAttribute("data-testid")
              ?.replace("list-item-", "");
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
          });
      }

      async function dragFirstModuleDown() {
        const grip = document.querySelector(
          '[data-testid="list-item-module-1"] [aria-hidden="true"]',
        ) as HTMLElement;
        grip.focus();
        fireEvent.keyDown(grip, { code: "Space", key: " " });
        await new Promise((resolve) => setTimeout(resolve, 0));
        fireEvent.keyDown(grip, { code: "ArrowDown", key: "ArrowDown" });
        fireEvent.keyDown(grip, { code: "Space", key: " " });
      }

      // Same technique as import-source-modal.test.tsx's own reorder tests,
      // for the modal's saved-Source workspace cards (`module-card-<id>`
      // testids).
      function stubModalCardRects(order: string[], itemHeight = 60) {
        return vi
          .spyOn(Element.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: Element) {
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
          });
      }

      async function dragFirstModalCardDown() {
        const card = screen.getByTestId("module-card-module-2");
        const handle = card.querySelector('span[role="button"]') as HTMLElement;
        handle.focus();
        fireEvent.keyDown(handle, { code: "Space", key: " " });
        await new Promise((resolve) => setTimeout(resolve, 0));
        fireEvent.keyDown(handle, { code: "ArrowDown", key: "ArrowDown" });
        fireEvent.keyDown(handle, { code: "Space", key: " " });
      }

      afterEach(() => {
        vi.restoreAllMocks();
      });

      /** Routes fetch for these tests directly (rather than the shared
       * `setupFetch`) since the Modules list must reflect the *result* of
       * the modal's own reorder PATCH on the next GET -- `setupFetch`'s
       * `modules` option is a fixed snapshot, not something a PATCH handler
       * can mutate and have later GETs observe. Also serves the modal's own
       * saved-Source workspace reads (Source lookup + Materials), which
       * `setupFetch` doesn't cover. */
      function setupSyncFetch(initialModules: Module[]) {
        let modulesState = initialModules;

        (fetch as ReturnType<typeof vi.fn>).mockImplementation(
          (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method ?? "GET";

            if (method === "GET" && url === "/api/v1/books/book-1") {
              return Promise.resolve(
                jsonResponse({ data: buildBookFixture() }),
              );
            }
            if (method === "GET" && url === "/api/v1/books/book-1/modules") {
              return Promise.resolve(jsonResponse({ data: modulesState }));
            }
            if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
              return Promise.resolve(
                jsonResponse({
                  data: [
                    { id: "source-1", bookId: "book-1", content: "Saved text" },
                  ],
                }),
              );
            }
            if (method === "GET" && url === "/api/v1/materials?bookId=book-1") {
              return Promise.resolve(jsonResponse({ data: [] }));
            }
            if (method === "PATCH" && url === "/api/v1/books/book-1") {
              const body = JSON.parse(init?.body as string) as {
                modules?: string[];
              };

              if (body.modules) {
                const byId = new Map(
                  modulesState.map((module) => [module.id, module]),
                );
                modulesState = body.modules.map((id) => byId.get(id)!);
              }

              return Promise.resolve(
                jsonResponse({ data: buildBookFixture() }),
              );
            }

            throw new Error(`Unhandled fetch: ${method} ${url}`);
          },
        );
      }

      it("opens Module Builder seeded with the page's own unsaved reorder draft, matched by id", async () => {
        setupSyncFetch([
          buildModuleFixture({ id: "module-1", title: { ar: "", en: "A" } }),
          buildModuleFixture({ id: "module-2", title: { ar: "", en: "B" } }),
          buildModuleFixture({ id: "module-3", title: { ar: "", en: "C" } }),
        ]);
        renderPage();

        await screen.findByText("A");
        stubItemRects(["module-1", "module-2", "module-3"]);
        await dragFirstModuleDown();
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[ABC]$/);
          expect(items.map((el) => el.textContent)).toEqual(["B", "A", "C"]);
        });

        fireEvent.click(screen.getByRole("button", { name: "Module Builder" }));
        await screen.findByRole("dialog", { name: "Module Builder" });

        const cards = await screen.findAllByTestId(/^module-card-(?!overlay-)/);
        const ids = cards
          .map((card) => card.getAttribute("data-testid") ?? "")
          .filter((testId) => !testId.endsWith("-editor-scale"));
        expect(ids).toEqual([
          "module-card-module-2",
          "module-card-module-1",
          "module-card-module-3",
        ]);
        // Merely opening, seeded from the outer draft, made no reorder
        // persistence request.
        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, patchInit]) => patchInit?.method === "PATCH",
          ),
        ).toBe(false);
      });

      it("a Module order saved inside Module Builder becomes this page's displayed order, superseding the stale outer draft", async () => {
        setupSyncFetch([
          buildModuleFixture({ id: "module-1", title: { ar: "", en: "A" } }),
          buildModuleFixture({ id: "module-2", title: { ar: "", en: "B" } }),
          buildModuleFixture({ id: "module-3", title: { ar: "", en: "C" } }),
        ]);
        renderPage();

        // 1. Local, unsaved reorder draft on this page: A,B,C -> B,A,C.
        await screen.findByText("A");
        stubItemRects(["module-1", "module-2", "module-3"]);
        await dragFirstModuleDown();
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[ABC]$/);
          expect(items.map((el) => el.textContent)).toEqual(["B", "A", "C"]);
        });

        // 2. Opens Module Builder -- correctly seeded from that draft
        // (B,A,C), per the previous test.
        fireEvent.click(screen.getByRole("button", { name: "Module Builder" }));
        const dialog = await screen.findByRole("dialog", {
          name: "Module Builder",
        });
        await screen.findByTestId("module-card-module-2");

        // 3. Reorders again inside the modal: B,A,C -> A,B,C (dragging the
        // modal's own first card, "B", down one position).
        stubModalCardRects(["module-2", "module-1", "module-3"]);
        await dragFirstModalCardDown();
        // Scoped to the modal -- the Book form's own submit button shares
        // this same label ("Save changes").
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save changes" }),
        );

        // 4. Once the modal's save succeeds and it closes, this page must
        // show the modal's newly saved order (A,B,C) -- not the stale outer
        // draft (B,A,C) it started with, even though A,B,C happens to also
        // be this fixture's original persisted order (proving the page
        // adopted the modal's save, not merely "reverted" the untouched
        // draft: a bug that left the stale B,A,C draft in place would still
        // display B,A,C here).
        await screen.findByRole("button", { name: "Module Builder" });
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[ABC]$/);
          expect(items.map((el) => el.textContent)).toEqual(["A", "B", "C"]);
        });
      });
    });

    describe("Delete (ANA-77)", () => {
      it("shows a confirmation, then DELETEs the Module and refreshes the list without a page reload", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          onDeleteModule: () => ({ status: 200, body: { ok: true } }),
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Delete أ" }));

        expect(
          screen.getByRole("dialog", { name: "Delete module?" }),
        ).toBeInTheDocument();

        // Re-routes the Modules fetch to report the Module gone, matching
        // what a real revalidation after a successful DELETE would return.
        setupFetch(buildBookFixture(), {
          modules: [],
          onDeleteModule: () => ({ status: 200, body: { ok: true } }),
        });
        fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

        await vi.waitFor(() =>
          expect(fetch).toHaveBeenCalledWith(
            "/api/v1/books/book-1/modules/module-1",
            { method: "DELETE" },
          ),
        );
        expect(
          await screen.findByText("This book has no modules yet."),
        ).toBeInTheDocument();
        expect(pushMock).not.toHaveBeenCalled();
      });

      it("makes no DELETE request when canceled", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Delete أ" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, init]) => init?.method === "DELETE",
          ),
        ).toBe(false);
        expect(screen.getByText("أ")).toBeInTheDocument();
      });

      it("keeps the Module visible and shows the error when the DELETE fails", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          onDeleteModule: () => ({
            status: 409,
            body: { error: "Module still has Lessons." },
          }),
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Delete أ" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

        expect(
          await screen.findByText("Module still has Lessons."),
        ).toBeInTheDocument();
        expect(screen.getByText("أ")).toBeInTheDocument();
      });

      it("preserves a pending reorder of the remaining Modules when one is deleted (ANA-94 PR review)", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "", en: "A" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "", en: "B" } }),
            buildModuleFixture({ id: "module-3", title: { ar: "", en: "C" } }),
          ],
          onDeleteModule: () => ({ status: 200, body: { ok: true } }),
        });
        renderPage();

        await screen.findByText("A");

        // Same keyboard-drag technique as the Reorder (ANA-79) tests --
        // dnd-kit's keyboard coordinate math needs real-ish rects, keyed by
        // ItemList's own testid scheme.
        const order = ["module-1", "module-2", "module-3"];
        const rectSpy = vi
          .spyOn(Element.prototype, "getBoundingClientRect")
          .mockImplementation(function (this: Element) {
            const container = this.closest('[data-testid^="list-item-"]');
            const id = container
              ?.getAttribute("data-testid")
              ?.replace("list-item-", "");
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

        // Drags "A" down past "B", unsaved: A,B,C -> B,A,C.
        const grip = document.querySelector(
          '[data-testid="list-item-module-1"] [aria-hidden="true"]',
        ) as HTMLElement;
        grip.focus();
        fireEvent.keyDown(grip, { code: "Space", key: " " });
        await new Promise((resolve) => setTimeout(resolve, 0));
        fireEvent.keyDown(grip, { code: "ArrowDown", key: "ArrowDown" });
        fireEvent.keyDown(grip, { code: "Space", key: " " });

        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[ABC]$/);
          expect(items.map((el) => el.textContent)).toEqual(["B", "A", "C"]);
        });

        rectSpy.mockRestore();

        // Re-routes the Modules fetch to report "C" gone, matching what a
        // real revalidation after a successful DELETE would return.
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "", en: "A" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "", en: "B" } }),
          ],
          onDeleteModule: () => ({ status: 200, body: { ok: true } }),
        });
        fireEvent.click(screen.getByRole("button", { name: "Delete C" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

        await vi.waitFor(() =>
          expect(fetch).toHaveBeenCalledWith(
            "/api/v1/books/book-1/modules/module-3",
            { method: "DELETE" },
          ),
        );

        // The B,A reorder survives the delete -- it must not revert to the
        // server's original, pre-reorder A,B order for the two remaining
        // Modules.
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[AB]$/);
          expect(items.map((el) => el.textContent)).toEqual(["B", "A"]);
        });
      });
    });

    describe("Materials load failure (ANA-94 PR review)", () => {
      it("blocks the Modules panel with an error instead of rendering it as if there were no Materials", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          materialsStatus: 500,
        });
        renderPage();

        expect(
          await screen.findByText(
            /Couldn.t load this book.s Learning Material/,
          ),
        ).toBeInTheDocument();
        // Neither the row nor Add module -- the whole panel, including its
        // Edit/Delete/Add actions -- ever renders while this is unresolved.
        expect(screen.queryByText("أ")).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Add module" }),
        ).not.toBeInTheDocument();
      });
    });

    describe("Create Module (ANA-94)", () => {
      it("opens the Add Module modal blank, with the default color", async () => {
        setupFetch(buildBookFixture(), { modules: [] });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        expect(within(dialog).getByLabelText("Title")).toHaveValue("");
        expect(
          within(dialog).getByRole("combobox", { name: "Color" }),
        ).toHaveValue(DEFAULT_APPLICATION_COLOR);
      });

      it("POSTs the entered fields and adds the backend-generated Module to the list only once creation succeeds", async () => {
        let createBody: unknown = null;
        let createMaterialBody: unknown = null;
        setupFetch(buildBookFixture(), {
          modules: [],
          onCreateModule: (body) => {
            createBody = body;
            return {
              status: 201,
              body: {
                data: buildModuleFixture({
                  id: "server-generated-id",
                  title: { ar: "وحدة جديدة", en: "" },
                  color: "pink.6",
                }),
              },
            };
          },
        });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        fireEvent.change(within(dialog).getByLabelText("Title"), {
          target: { value: "وحدة جديدة" },
        });
        fireEvent.click(within(dialog).getByRole("radio", { name: "Pink" }));

        // Re-routes the Modules GET to report the newly created Module,
        // matching what a real revalidation after a successful POST would
        // return -- the backend, not this page, decides the final id.
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({
              id: "server-generated-id",
              title: { ar: "وحدة جديدة", en: "" },
              color: "pink.6",
            }),
          ],
          onCreateModule: (body) => {
            createBody = body;
            return {
              status: 201,
              body: { data: buildModuleFixture({ id: "server-generated-id" }) },
            };
          },
          // The Content field is this Module's Learning Material, created
          // through the Material API once the real Module id is known
          // (ANA-94 PR review) -- never dropped, and never sent as part of
          // the Module create body above.
          onCreateMaterial: (body) => {
            createMaterialBody = body;
            return {
              status: 201,
              body: {
                data: buildMaterialFixture({
                  id: "material-1",
                  moduleId: "server-generated-id",
                }),
              },
            };
          },
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        expect(await screen.findByText("وحدة جديدة")).toBeInTheDocument();
        await vi.waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Add Module" }),
          ).not.toBeInTheDocument(),
        );
        expect(createBody).toMatchObject({
          title: { ar: "وحدة جديدة", en: "" },
          color: "pink.6",
          isLocked: false,
          isPublished: false,
        });
        expect(createBody).not.toHaveProperty("content");
        await vi.waitFor(() =>
          expect(createMaterialBody).toMatchObject({
            bookId: "book-1",
            moduleId: "server-generated-id",
            content: { ar: "", en: "" },
          }),
        );
      });

      it("keeps the modal open and shows the error when creation fails, adding nothing to the list", async () => {
        setupFetch(buildBookFixture(), {
          modules: [],
          onCreateModule: () => ({
            status: 500,
            body: { error: "Something went wrong." },
          }),
        });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        expect(
          await within(dialog).findByText("Something went wrong."),
        ).toBeInTheDocument();
        expect(
          screen.getByText("This book has no modules yet."),
        ).toBeInTheDocument();
      });

      it("never generates or sends a client-side Module id", async () => {
        let createBody: Record<string, unknown> | null = null;
        setupFetch(buildBookFixture(), {
          modules: [],
          onCreateModule: (body) => {
            createBody = body as Record<string, unknown>;
            return {
              status: 201,
              body: { data: buildModuleFixture({ id: "server-generated-id" }) },
            };
          },
        });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));
        const dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        await vi.waitFor(() => expect(createBody).not.toBeNull());
        expect(createBody).not.toHaveProperty("id");
      });

      it("does not create a second Module when Save Module is retried after a Material-creation failure (ANA-94 PR review)", async () => {
        let createModuleCalls = 0;
        let createMaterialCalls = 0;
        setupFetch(buildBookFixture(), {
          modules: [],
          onCreateModule: () => {
            createModuleCalls += 1;
            return {
              status: 201,
              body: { data: buildModuleFixture({ id: "server-generated-id" }) },
            };
          },
          onCreateMaterial: () => {
            createMaterialCalls += 1;
            // Fails the first attempt; a retry (same Save Module click
            // again) should succeed without a second Module create.
            return createMaterialCalls === 1
              ? { status: 500, body: { error: "Something went wrong." } }
              : {
                  status: 201,
                  body: {
                    data: buildMaterialFixture({
                      id: "material-1",
                      moduleId: "server-generated-id",
                    }),
                  },
                };
          },
        });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));
        const dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        expect(
          await within(dialog).findByText("Something went wrong."),
        ).toBeInTheDocument();
        expect(createModuleCalls).toBe(1);
        expect(createMaterialCalls).toBe(1);

        // Re-routes the Modules GET to report the Module, matching what a
        // real revalidation after the retry succeeds would return.
        setupFetch(buildBookFixture(), {
          modules: [buildModuleFixture({ id: "server-generated-id" })],
          onCreateModule: () => {
            createModuleCalls += 1;
            return {
              status: 201,
              body: { data: buildModuleFixture({ id: "server-generated-id" }) },
            };
          },
          onCreateMaterial: () => {
            createMaterialCalls += 1;
            return {
              status: 201,
              body: {
                data: buildMaterialFixture({
                  id: "material-1",
                  moduleId: "server-generated-id",
                }),
              },
            };
          },
        });

        // Retries by clicking Save Module again -- must reuse the Module
        // already created above, never call createModule a second time.
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        await vi.waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Add Module" }),
          ).not.toBeInTheDocument(),
        );
        expect(createModuleCalls).toBe(1);
        expect(createMaterialCalls).toBe(2);
      });

      it("starts a genuinely new create (calls createModule again) if a failed attempt is abandoned via Cancel", async () => {
        let createModuleCalls = 0;
        setupFetch(buildBookFixture(), {
          modules: [],
          onCreateModule: () => {
            createModuleCalls += 1;
            return {
              status: 201,
              body: {
                data: buildModuleFixture({
                  id: `server-generated-id-${createModuleCalls}`,
                }),
              },
            };
          },
          onCreateMaterial: () => ({
            status: 500,
            body: { error: "Something went wrong." },
          }),
        });
        renderPage();

        await screen.findByText("This book has no modules yet.");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));
        let dialog = await screen.findByRole("dialog", {
          name: "Add Module",
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );
        await within(dialog).findByText("Something went wrong.");
        expect(createModuleCalls).toBe(1);

        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await vi.waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Add Module" }),
          ).not.toBeInTheDocument(),
        );

        // A genuinely new Add Module session -- must not reuse the id
        // left over from the abandoned attempt above.
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));
        dialog = await screen.findByRole("dialog", { name: "Add Module" });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save Module" }),
        );

        await vi.waitFor(() => expect(createModuleCalls).toBe(2));
      });
    });

    describe("Edit Module modal", () => {
      it("opens seeded with the Module's Title, Description, Color, and existing Content (its Learning Material, ANA-94 PR review)", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({
              id: "module-1",
              title: { ar: "أ", en: "A" },
              description: { ar: "وصف", en: "Desc" },
              color: "cyan.6",
            }),
          ],
          materials: [
            buildMaterialFixture({
              id: "material-1",
              moduleId: "module-1",
              content: { ar: "محتوى موجود", en: "" },
            }),
          ],
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        expect(within(dialog).getByLabelText("Title")).toHaveValue("أ");
        expect(within(dialog).getByLabelText("Description")).toHaveValue("وصف");
        expect(
          within(dialog).getByRole("combobox", { name: "Color" }),
        ).toHaveValue("cyan.6");
        expect(
          await within(dialog).findByText("محتوى موجود"),
        ).toBeInTheDocument();
      });

      it("opens seeded with blank Content when the Module has no Material yet", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          materials: [],
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        // Content (a Markdown editor) has nothing to assert a value on
        // directly -- absence of the seeded-content case's text is enough
        // to show it started blank rather than reusing another Module's.
        expect(screen.queryByText("محتوى موجود")).not.toBeInTheDocument();
        expect(dialog).toBeInTheDocument();
      });

      it("PATCHes the edited fields and updates the displayed title only once saving succeeds", async () => {
        let patchBody: unknown = null;
        let createMaterialBody: unknown = null;
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          onUpdateModule: (moduleId, body) => {
            patchBody = body;
            return {
              status: 200,
              body: {
                data: buildModuleFixture({
                  id: moduleId,
                  title: { ar: "المقدمة", en: "" },
                }),
              },
            };
          },
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        fireEvent.change(within(dialog).getByLabelText("Title"), {
          target: { value: "المقدمة" },
        });

        // Re-routes the Modules GET to report the edited title, matching
        // what a real revalidation after a successful PATCH would return.
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({
              id: "module-1",
              title: { ar: "المقدمة", en: "" },
            }),
          ],
          onUpdateModule: (moduleId, body) => {
            patchBody = body;
            return {
              status: 200,
              body: { data: buildModuleFixture({ id: moduleId }) },
            };
          },
          // module-1 has no existing Material in this test, so saving its
          // Content (this Module's Learning Material, ANA-94 PR review)
          // goes through create, not update.
          onCreateMaterial: (body) => {
            createMaterialBody = body;
            return {
              status: 201,
              body: {
                data: buildMaterialFixture({
                  id: "material-1",
                  moduleId: "module-1",
                }),
              },
            };
          },
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save changes" }),
        );

        expect(await screen.findByText("المقدمة")).toBeInTheDocument();
        expect(screen.queryByText("أ")).not.toBeInTheDocument();
        await vi.waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Edit Module" }),
          ).not.toBeInTheDocument(),
        );
        expect(patchBody).toMatchObject({ title: { ar: "المقدمة", en: "" } });
        expect(patchBody).not.toHaveProperty("isLocked");
        expect(patchBody).not.toHaveProperty("isPublished");
        expect(patchBody).not.toHaveProperty("content");
        await vi.waitFor(() =>
          expect(createMaterialBody).toMatchObject({
            bookId: "book-1",
            moduleId: "module-1",
            content: { ar: "", en: "" },
          }),
        );
      });

      it("PATCHes the existing Material's content when the Module already has one, instead of creating a second one", async () => {
        let updateMaterialId: string | null = null;
        let updateMaterialBody: unknown = null;
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          materials: [
            buildMaterialFixture({
              id: "material-1",
              moduleId: "module-1",
              content: { ar: "قديم", en: "" },
            }),
          ],
          onUpdateModule: (moduleId) => ({
            status: 200,
            body: { data: buildModuleFixture({ id: moduleId }) },
          }),
          onUpdateMaterial: (materialId, body) => {
            updateMaterialId = materialId;
            updateMaterialBody = body;
            return {
              status: 200,
              body: {
                data: buildMaterialFixture({
                  id: materialId,
                  moduleId: "module-1",
                  content: { ar: "جديد", en: "" },
                }),
              },
            };
          },
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        expect(await within(dialog).findByText("قديم")).toBeInTheDocument();

        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save changes" }),
        );

        await vi.waitFor(() => expect(updateMaterialId).toBe("material-1"));
        expect(updateMaterialBody).toMatchObject({
          content: { ar: "قديم", en: "" },
        });
      });

      it("keeps the modal open and shows the error when saving fails, without changing the displayed title", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          onUpdateModule: () => ({
            status: 500,
            body: { error: "Something went wrong." },
          }),
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        fireEvent.change(within(dialog).getByLabelText("Title"), {
          target: { value: "المقدمة" },
        });
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Save changes" }),
        );

        expect(
          await within(dialog).findByText("Something went wrong."),
        ).toBeInTheDocument();
        expect(screen.getByText("أ")).toBeInTheDocument();
      });

      it("Cancel closes the modal without changing the displayed title or making a network request", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Edit أ" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Edit Module",
        });
        fireEvent.change(within(dialog).getByLabelText("Title"), {
          target: { value: "المقدمة" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

        await vi.waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Edit Module" }),
          ).not.toBeInTheDocument(),
        );
        expect(screen.getByText("أ")).toBeInTheDocument();
        expect(
          (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
            ([, init]) => init?.method === "PATCH",
          ),
        ).toBe(false);
      });
    });
  });
});
