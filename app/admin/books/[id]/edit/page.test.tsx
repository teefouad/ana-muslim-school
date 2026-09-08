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
 * Book has loaded -- see page.tsx's conditional SWR key), the page's own
 * Source-by-bookId lookup (which drives the header button's label),
 * optionally `PATCH` the Book on save, and optionally `DELETE` a Module
 * (ANA-77). */
function setupFetch(
  book: ReturnType<typeof buildBookFixture> | null,
  options: {
    bookStatus?: number;
    modules?: Module[];
    hasSource?: boolean;
    onPatch?: (body: unknown) => { status: number; body: unknown };
    onDeleteModule?: (moduleId: string) => { status: number; body: unknown };
  } = {},
) {
  const {
    bookStatus = 200,
    modules = [],
    hasSource = false,
    onPatch,
    onDeleteModule,
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

      const deleteModuleMatch =
        /^\/api\/v1\/books\/book-1\/modules\/(.+)$/.exec(url);

      if (method === "DELETE" && deleteModuleMatch && onDeleteModule) {
        const { status, body } = onDeleteModule(deleteModuleMatch[1]);
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
    const importSource = await screen.findByRole("button", {
      name: "Create from PDF",
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
      screen.queryByRole("button", { name: "Create from PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View source text" }),
    ).not.toBeInTheDocument();

    resolveSources(jsonResponse({ data: [] }));

    expect(
      await screen.findByRole("button", { name: "Create from PDF" }),
    ).toBeInTheDocument();
  });

  it("keeps the Source action button hidden if the Source lookup fails, instead of guessing Create from PDF (ANA-75)", async () => {
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
      screen.queryByRole("button", { name: "Create from PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View source text" }),
    ).not.toBeInTheDocument();
  });

  it("labels the header button View source text when the Book already has a saved Source", async () => {
    setupFetch(buildBookFixture(), { hasSource: true });
    renderPage();

    expect(
      await screen.findByRole("button", { name: "View source text" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create from PDF" }),
    ).not.toBeInTheDocument();
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

    describe("Reorder (ANA-79)", () => {
      // Same technique as modules-panel.test.tsx/item-list.test.tsx's own
      // keyboard-drag tests -- dnd-kit's keyboard coordinate math needs
      // real-ish rects, keyed by ItemList's own testid scheme.
      function stubItemRects(order: string[], itemHeight = 60) {
        vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
          function (this: Element) {
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
          },
        );
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

      it("PATCHes /api/v1/books/{bookId} with the dropped order and keeps it after revalidation", async () => {
        const allModules = [
          buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
        ];
        let patchedModules: string[] | null = null;
        // Mirrors the real reorder endpoint: GET /modules reflects whatever
        // order the PATCH last persisted, so revalidation after a
        // successful reorder confirms the *server's* order, not just the
        // optimistic one.
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
              const order = patchedModules ?? ["module-1", "module-2"];
              return Promise.resolve(
                jsonResponse({
                  data: order.map((id) => allModules.find((m) => m.id === id)!),
                }),
              );
            }
            if (method === "GET" && url === "/api/v1/sources?bookId=book-1") {
              return Promise.resolve(jsonResponse({ data: [] }));
            }
            if (method === "PATCH" && url === "/api/v1/books/book-1") {
              patchedModules = (
                JSON.parse(init?.body as string) as {
                  modules: string[];
                }
              ).modules;
              return Promise.resolve(
                jsonResponse({ data: buildBookFixture() }),
              );
            }
            throw new Error(`Unhandled fetch: ${method} ${url}`);
          },
        );
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        await vi.waitFor(() =>
          expect(patchedModules).toEqual(["module-2", "module-1"]),
        );
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[أب]$/);
          expect(items.map((el) => el.textContent)).toEqual(["ب", "أ"]);
        });
      });

      it("reverts to the server order and shows an error when the reorder PATCH fails", async () => {
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
            buildModuleFixture({ id: "module-2", title: { ar: "ب", en: "" } }),
          ],
          onPatch: () => ({
            status: 409,
            body: {
              error: "`modules` must be a reorder of the exact current set.",
            },
          }),
        });
        renderPage();

        await screen.findByText("أ");
        stubItemRects(["module-1", "module-2"]);
        await dragFirstModuleDown();

        expect(
          await screen.findByText(
            "`modules` must be a reorder of the exact current set.",
          ),
        ).toBeInTheDocument();
        // Reverted to the original, still-persisted order.
        await vi.waitFor(async () => {
          const items = await screen.findAllByText(/^[أب]$/);
          expect(items.map((el) => el.textContent)).toEqual(["أ", "ب"]);
        });
      });

      it("does not persist Add module's local-only blank entry as a reorder", async () => {
        let patchCalled = false;
        setupFetch(buildBookFixture(), {
          modules: [
            buildModuleFixture({ id: "module-1", title: { ar: "أ", en: "" } }),
          ],
          onPatch: () => {
            patchCalled = true;
            return { status: 200, body: { data: buildBookFixture() } };
          },
        });
        renderPage();

        await screen.findByText("أ");
        fireEvent.click(screen.getByRole("button", { name: "Add module" }));

        expect(patchCalled).toBe(false);
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
    });
  });
});
