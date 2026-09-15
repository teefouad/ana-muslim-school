import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

const { useParamsMock } = vi.hoisted(() => ({
  useParamsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
}));

import EditModulePage from "./page";
import { buildLessonFixture } from "../../../../lesson-fixtures";
import type { Lesson } from "@/lib/lessons/types";
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
    title: { ar: "", en: "Module 1" },
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
 * request this page makes: `GET` the Module, `GET` its Lessons, and
 * optionally `PATCH` the Module (reorder) or `POST` a Lesson (create). */
function setupFetch(
  moduleDoc: Module | null,
  options: {
    moduleStatus?: number;
    lessons?: Lesson[];
    onReorder?: (body: unknown) => { status: number; body: unknown };
    onCreateLesson?: (body: unknown) => { status: number; body: unknown };
  } = {},
) {
  const {
    moduleStatus = 200,
    lessons = [],
    onReorder,
    onCreateLesson,
  } = options;

  (fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url === "/api/v1/books/book-1/modules/module-1") {
        return Promise.resolve(
          moduleDoc
            ? jsonResponse({ data: moduleDoc }, moduleStatus)
            : jsonResponse({ error: "Module not found." }, moduleStatus),
        );
      }

      if (
        method === "GET" &&
        url === "/api/v1/books/book-1/modules/module-1/lessons"
      ) {
        return Promise.resolve(jsonResponse({ data: lessons }));
      }

      if (
        method === "PATCH" &&
        url === "/api/v1/books/book-1/modules/module-1" &&
        onReorder
      ) {
        const { status, body } = onReorder(JSON.parse(init?.body as string));
        return Promise.resolve(jsonResponse(body, status));
      }

      if (
        method === "POST" &&
        url === "/api/v1/books/book-1/modules/module-1/lessons" &&
        onCreateLesson
      ) {
        const { status, body } = onCreateLesson(
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
      {/* A fresh SWR cache per render -- see [id]/edit/page.test.tsx. */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EditModulePage />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("EditModulePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useParamsMock.mockReturnValue({ id: "book-1", moduleId: "module-1" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads the Module, then its Lessons once the Module resolves", async () => {
    setupFetch(buildModuleFixture());
    renderPage();

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1/modules/module-1");

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/books/book-1/modules/module-1/lessons",
      ),
    );
  });

  it("never requests Lessons for a Module that 404s", async () => {
    setupFetch(null, { moduleStatus: 404 });
    renderPage();

    await screen.findByText("This module could not be found.");

    expect(fetch).not.toHaveBeenCalledWith(
      "/api/v1/books/book-1/modules/module-1/lessons",
    );
  });

  it("renders lessons in the Module's persisted order", async () => {
    setupFetch(buildModuleFixture(), {
      lessons: [
        buildLessonFixture({ id: "lesson-1", title: { ar: "", en: "First" } }),
        buildLessonFixture({
          id: "lesson-2",
          title: { ar: "", en: "Second" },
        }),
      ],
    });
    renderPage();

    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId(/^list-item-/)
        .map((el) => el.getAttribute("data-testid")),
    ).toEqual(["list-item-lesson-1", "list-item-lesson-2"]);
  });

  it("shows a not-found state for a 404", async () => {
    setupFetch(null, { moduleStatus: 404 });
    renderPage();

    expect(
      await screen.findByText("This module could not be found."),
    ).toBeInTheDocument();
  });

  it("shows the dashed 'Select a lesson to edit.' placeholder, and never a Lesson form", async () => {
    setupFetch(buildModuleFixture(), { lessons: [buildLessonFixture()] });
    renderPage();

    expect(
      await screen.findByText("Select a lesson to edit."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("persists a drag reorder through PATCH .../modules/{moduleId} with the new lesson order", async () => {
    const onReorder = vi.fn((body: unknown) => ({
      status: 200,
      body: {
        data: {
          ...buildModuleFixture(),
          lessons: (body as { lessons: string[] }).lessons,
        },
      },
    }));
    setupFetch(buildModuleFixture(), {
      lessons: [
        buildLessonFixture({ id: "lesson-1", title: { ar: "", en: "First" } }),
        buildLessonFixture({
          id: "lesson-2",
          title: { ar: "", en: "Second" },
        }),
      ],
      onReorder,
    });
    renderPage();

    await screen.findByText("First");

    const grip = document.querySelector(
      '[data-testid="list-item-lesson-2"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    await waitFor(() =>
      expect(onReorder).toHaveBeenCalledWith({
        lessons: ["lesson-2", "lesson-1"],
      }),
    );
  });

  it("shows an error and restores the previous order when a reorder request fails", async () => {
    const onReorder = vi.fn(() => ({
      status: 400,
      body: { error: "Reorder failed." },
    }));
    setupFetch(buildModuleFixture(), {
      lessons: [
        buildLessonFixture({ id: "lesson-1", title: { ar: "", en: "First" } }),
        buildLessonFixture({
          id: "lesson-2",
          title: { ar: "", en: "Second" },
        }),
      ],
      onReorder,
    });
    renderPage();

    await screen.findByText("First");

    const grip = document.querySelector(
      '[data-testid="list-item-lesson-2"] [aria-hidden="true"]',
    ) as HTMLElement;
    grip.focus();
    fireEvent.keyDown(grip, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(grip, { code: "Space", key: " " });

    expect(await screen.findByText("Reorder failed.")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen
          .getAllByTestId(/^list-item-/)
          .map((el) => el.getAttribute("data-testid")),
      ).toEqual(["list-item-lesson-1", "list-item-lesson-2"]);
    });
  });

  it("creates a Lesson with the existing/default Lesson values when Add lesson is clicked", async () => {
    const onCreateLesson = vi.fn(() => ({
      status: 201,
      body: { data: { ...buildLessonFixture(), id: "lesson-new" } },
    }));
    setupFetch(buildModuleFixture(), { lessons: [], onCreateLesson });
    renderPage();

    await screen.findByRole("button", { name: "Add lesson" });
    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    await waitFor(() =>
      expect(onCreateLesson).toHaveBeenCalledWith({
        title: { ar: "", en: "" },
        description: { ar: "", en: "" },
        type: "text",
        position: 2,
        reward: { coins: 0 },
        duration: 0,
        videoURL: "",
        azkar: [],
        questions: [],
        isLocked: false,
        isPublished: false,
      }),
    );
  });

  it("only shows the new Lesson in the list after creation succeeds", async () => {
    let lessonsSnapshot: Lesson[] = [];
    const onCreateLesson = vi.fn(() => {
      const created = buildLessonFixture({
        id: "lesson-new",
        title: { ar: "", en: "New lesson" },
      });
      lessonsSnapshot = [created];
      return { status: 201, body: { data: created } };
    });

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "GET" &&
          url === "/api/v1/books/book-1/modules/module-1"
        ) {
          return Promise.resolve(jsonResponse({ data: buildModuleFixture() }));
        }
        if (
          method === "GET" &&
          url === "/api/v1/books/book-1/modules/module-1/lessons"
        ) {
          return Promise.resolve(jsonResponse({ data: lessonsSnapshot }));
        }
        if (
          method === "POST" &&
          url === "/api/v1/books/book-1/modules/module-1/lessons"
        ) {
          const { status, body } = onCreateLesson();
          return Promise.resolve(jsonResponse(body, status));
        }

        throw new Error(`Unhandled fetch: ${method} ${url}`);
      },
    );

    renderPage();

    await screen.findByRole("button", { name: "Add lesson" });
    expect(screen.queryByText("New lesson")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(await screen.findByText("New lesson")).toBeInTheDocument();
  });

  it("does not insert a Lesson into the list when creation fails", async () => {
    const onCreateLesson = vi.fn(() => ({
      status: 500,
      body: { error: "Something went wrong." },
    }));
    setupFetch(buildModuleFixture(), { lessons: [], onCreateLesson });
    renderPage();

    await screen.findByRole("button", { name: "Add lesson" });
    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This module has no lessons yet."),
    ).toBeInTheDocument();
  });
});
