import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditModuleModal,
  type EditModuleModalProps,
  type EditModuleModalState,
} from "./edit-module-modal";
import { buildLessonFixture } from "./lesson-fixtures";
import { createEmptyModuleFieldsValues } from "./module-fields";
import { buildQuestionFixture } from "./question-fixtures";
import { DEFAULT_APPLICATION_COLOR } from "@/components/ui/application-colors";
import type { Book } from "@/lib/books/types";
import type { Lesson } from "@/lib/lessons/types";
import type { Question } from "@/lib/questions/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Selects the first `length` characters of the editor's first text node
// directly through the native Selection API -- ported from form-field.test.tsx
// (see that file's identical helper for why jsdom needs this instead of
// simulated cursor movement).
function selectFirstCharacters(root: HTMLElement, length: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function lastRequestBody(): Record<string, unknown> {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

/** Every fetch call other than the automatic Lessons/Questions GET every
 * `edit`-mode render fires on mount (ANA-116, Questions GET added in
 * ANA-119) -- what most of these tests actually want to assert on (a
 * single AI request, a single Lesson mutation). */
function mutationCalls(): [string, RequestInit][] {
  return (
    (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][]
  ).filter(
    ([url, init]) =>
      !(
        typeof url === "string" &&
        (url.endsWith("/lessons") || url.endsWith("/questions")) &&
        (init?.method ?? "GET").toUpperCase() === "GET"
      ),
  ) as [string, RequestInit][];
}

/** Routes every fetch call in these tests (ANA-116, Questions routing added
 * in ANA-119): a `GET .../lessons` or `GET .../questions` request -- each
 * fired automatically on every `edit`-mode render, independent of whatever
 * a given test is actually exercising, and again by every
 * `mutateLessons`/`mutateQuestions(..., { revalidate: true })` background
 * refetch -- always resolves from an in-memory `current`/`currentQuestions`
 * list seeded from `lessons`/`questions`; every other call (an AI request, a
 * Lesson/Question create/update/delete) resolves with `other`/`otherStatus`.
 * A *successful* (2xx) mutation also updates the matching in-memory list
 * from `other`'s own `{ data: ... }` shape (or, for a Lesson delete, just
 * drops the id) -- so the background revalidation a mutation triggers
 * reflects the same change the mutation itself just made, instead of the
 * revalidate GET's static response reverting it. */
function mockFetch({
  lessons = [],
  questions = [],
  other,
  otherStatus = 200,
  questionOther,
  questionOtherStatus = 200,
}: {
  lessons?: Lesson[];
  questions?: Question[];
  other?: unknown;
  otherStatus?: number;
  /** Forces a specific Question POST/PATCH response (most often a failure)
   * -- see the routing comment above `isQuestionMutation` below. Omit to
   * auto-echo the request body back as a persisted Question. */
  questionOther?: unknown;
  questionOtherStatus?: number;
} = {}) {
  let current: Lesson[] = [...lessons];
  let currentQuestions: Question[] = [...questions];
  let nextQuestionId = 1;

  (fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (url: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlStr = typeof url === "string" ? url : String(url);
      const isLessonsList = urlStr.endsWith("/lessons");
      const lessonMatch = urlStr.match(/\/lessons\/([^/]+)$/);
      const isQuestionsList = urlStr.endsWith("/questions");
      const questionMatch = urlStr.match(/\/questions\/([^/]+)$/);

      if (isLessonsList && method === "GET") {
        return Promise.resolve(jsonResponse({ data: current }));
      }

      if (isQuestionsList && method === "GET") {
        return Promise.resolve(jsonResponse({ data: currentQuestions }));
      }

      const isLessonMutation =
        (isLessonsList && method === "POST") ||
        (lessonMatch !== null && (method === "PATCH" || method === "DELETE"));

      if (isLessonMutation) {
        if (other === undefined) {
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        }

        if (otherStatus >= 200 && otherStatus < 300) {
          const body = other as { data?: Lesson };
          if (isLessonsList && method === "POST" && body.data) {
            current = [...current, body.data];
          } else if (lessonMatch && method === "PATCH" && body.data) {
            const id = lessonMatch[1];
            current = current.map((lesson) =>
              lesson.id === id ? (body.data as Lesson) : lesson,
            );
          } else if (lessonMatch && method === "DELETE") {
            const id = lessonMatch[1];
            current = current.filter((lesson) => lesson.id !== id);
          }
        }

        return Promise.resolve(jsonResponse(other, otherStatus));
      }

      const isQuestionMutation =
        (isQuestionsList && method === "POST") ||
        (questionMatch !== null && method === "PATCH");

      if (isQuestionMutation) {
        // A test that wants to force a specific Question mutation outcome
        // (most often a failure) passes `questionOther`/`questionOtherStatus`
        // explicitly -- otherwise this auto-echoes the request body back as
        // a persisted Question, since most Lesson-save tests don't care
        // about the exact Question response shape, only that Save
        // succeeds/fails and what ends up in `Lesson.questions`.
        if (questionOther !== undefined) {
          if (questionOtherStatus >= 200 && questionOtherStatus < 300) {
            const body = questionOther as { data?: Question };
            if (isQuestionsList && method === "POST" && body.data) {
              currentQuestions = [...currentQuestions, body.data];
            } else if (questionMatch && method === "PATCH" && body.data) {
              const id = questionMatch[1];
              currentQuestions = currentQuestions.map((question) =>
                question.id === id ? (body.data as Question) : question,
              );
            }
          }

          return Promise.resolve(
            jsonResponse(questionOther, questionOtherStatus),
          );
        }

        const requestBody = init?.body
          ? (JSON.parse(init.body as string) as Partial<Question>)
          : {};

        if (isQuestionsList && method === "POST") {
          const created: Question = {
            id: `question-${nextQuestionId++}`,
            text: requestBody.text ?? { ar: "", en: "" },
            explanation: requestBody.explanation ?? { ar: "", en: "" },
            choices: requestBody.choices ?? [],
            createdAt: new Date(0),
            updatedAt: new Date(0),
            createdBy: "a@example.com",
            updatedBy: "a@example.com",
          };
          currentQuestions = [...currentQuestions, created];
          return Promise.resolve(jsonResponse({ data: created }, 201));
        }

        if (questionMatch) {
          const id = questionMatch[1];
          const existing = currentQuestions.find(
            (question) => question.id === id,
          );
          const updated: Question = {
            ...(existing as Question),
            ...requestBody,
          };
          currentQuestions = currentQuestions.map((question) =>
            question.id === id ? updated : question,
          );
          return Promise.resolve(jsonResponse({ data: updated }));
        }
      }

      if (other !== undefined) {
        return Promise.resolve(jsonResponse(other, otherStatus));
      }

      return Promise.resolve(
        jsonResponse({ error: "Unhandled fetch in test." }, 500),
      );
    },
  );
}

// Title and Description are plain text inputs (also role "textbox"); the
// Content field's own contenteditable Markdown editor -- the only one with
// a `contenteditable` attribute -- renders last (see the existing selection
// test below for the identical convention).
function getContentEditable(dialog: HTMLElement): HTMLElement {
  const textboxes = within(dialog).getAllByRole("textbox");
  return textboxes[textboxes.length - 1];
}

// dnd-kit's collision detection/keyboard coordinate getter is driven by real
// element geometry, which jsdom always reports as a zeroed-out rect --
// ported from lessons-panel.test.tsx's identical helper (ANA-117).
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

const BOOK: Book = {
  id: "book-1",
  title: { ar: "عنوان الكتاب", en: "Book Title" },
  description: { ar: "وصف الكتاب", en: "Book Description" },
  longDescription: { ar: "وصف طويل للكتاب", en: "Book Long Description" },
  color: "cyan.6",
  imageId: "img-1",
  modules: [],
  isLocked: false,
  isPublished: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: "a@example.com",
  updatedBy: "a@example.com",
};

const EDIT_FIELDS = {
  title: { ar: "المقدمة", en: "" },
  description: { ar: "وصف", en: "" },
  color: "cyan.6",
  content: { ar: "محتوى", en: "" },
  isPublished: false,
};

function renderModal(overrides: Partial<EditModuleModalProps> = {}) {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak fixture Lessons data (and in-flight requests) across
          test cases keyed by the same `/lessons` URL (see AGENTS.md). */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EditModuleModal
          state={{ mode: "edit", id: "module-1", fields: EDIT_FIELDS }}
          book={BOOK}
          onClose={vi.fn()}
          onCreate={vi.fn().mockResolvedValue(undefined)}
          onSave={vi.fn().mockResolvedValue(undefined)}
          {...overrides}
        />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("EditModuleModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockFetch();
  });

  it("renders nothing when state is null", () => {
    renderModal({ state: null });

    expect(
      screen.queryByRole("dialog", { name: "Edit Module" }),
    ).not.toBeInTheDocument();
  });

  describe("create mode (ANA-94)", () => {
    it("opens titled 'Add Module' with every field blank, primary action 'Save Module'", async () => {
      renderModal({ state: { mode: "create" } });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).toHaveValue(DEFAULT_APPLICATION_COLOR);
      expect(
        within(dialog).getByRole("button", { name: "Save Module" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument();
    });

    it("calls onCreate with the entered fields, then onClose, once creation succeeds", async () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ state: { mode: "create" }, onCreate, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "وحدة جديدة" },
      });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Pink" }));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Module" }),
      );

      await vi.waitFor(() => expect(onCreate).toHaveBeenCalled());
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.objectContaining({ ar: "وحدة جديدة" }),
          color: "pink.6",
        }),
      );
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("keeps the modal open and shows the error when creation fails, without calling onClose", async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error("Book not found."));
      const onClose = vi.fn();
      renderModal({ state: { mode: "create" }, onCreate, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Module" }),
      );

      expect(
        await within(dialog).findByText("Book not found."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("edit mode", () => {
    it("opens titled 'Edit Module', seeded with Title, Description, Color, and Content", async () => {
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");
      expect(within(dialog).getByLabelText("Description")).toHaveValue("وصف");
      expect(await within(dialog).findByText("محتوى")).toBeInTheDocument();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).toHaveValue("cyan.6");
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeInTheDocument();
    });

    it("calls onSave with the module id and edited fields, then onClose, once saving succeeds", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "module-1",
          expect.objectContaining({ title: { ar: "عنوان جديد", en: "" } }),
          // No Lesson drag happened this session -- `lessonsOrder` is
          // `null` (ANA-117), never the load order resent as if reordered.
          null,
        ),
      );
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("keeps the modal open and shows the error when saving fails, without calling onClose", async () => {
      const onSave = vi.fn().mockRejectedValue(new Error("Module not found."));
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        await within(dialog).findByText("Module not found."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose without onCreate/onSave when Cancel is clicked", async () => {
      const onCreate = vi.fn();
      const onSave = vi.fn();
      const onClose = vi.fn();
      renderModal({ onCreate, onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("seeds a brand-new Module's fields (createEmptyModuleFieldsValues) with blanks", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-new",
          fields: createEmptyModuleFieldsValues(),
        },
      });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
    });
  });

  describe("Published toggle (ANA-117)", () => {
    it("seeds Published from the Module's own current isPublished", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-1",
          fields: { ...EDIT_FIELDS, isPublished: true },
        },
      });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("switch", { name: "Published" }),
      ).toBeChecked();
    });

    it("includes the toggled Published value in the Module save", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderModal({ onSave });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("switch", { name: "Published" }),
      ).not.toBeChecked();
      fireEvent.click(
        within(dialog).getByRole("switch", { name: "Published" }),
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "module-1",
          expect.objectContaining({ isPublished: true }),
          null,
        ),
      );
    });

    it("defaults a brand-new Module's Published to off", async () => {
      renderModal({
        state: {
          mode: "edit",
          id: "module-new",
          fields: createEmptyModuleFieldsValues(),
        },
      });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("switch", { name: "Published" }),
      ).not.toBeChecked();
    });
  });

  describe("modal width (ANA-115 PR review)", () => {
    function modalSizeStyle(): string {
      const root = document.querySelector(".mantine-Modal-root");
      return root?.getAttribute("style") ?? "";
    }

    it("uses a 900px modal width in Module mode", async () => {
      mockFetch({ lessons: [buildLessonFixture({ id: "lesson-1" })] });
      renderModal();

      await screen.findByRole("dialog", { name: "Edit Module" });
      expect(modalSizeStyle()).toContain("min(900px, calc(100vw - 48px))");
    });

    it("keeps the same 900px modal width in Lesson mode -- the modal never grows when switching modes", async () => {
      mockFetch({
        lessons: [
          buildLessonFixture({ id: "lesson-1", title: { ar: "أ", en: "" } }),
        ],
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        await within(dialog).findByRole("button", { name: "Edit أ" }),
      );

      await within(dialog).findByTestId("lesson-form");
      expect(modalSizeStyle()).toContain("min(900px, calc(100vw - 48px))");
    });

    it("does not use the modal's own default width in create mode", async () => {
      renderModal({ state: { mode: "create" } });

      await screen.findByRole("dialog", { name: "Add Module" });
      expect(modalSizeStyle()).not.toContain("900px");
    });
  });

  describe("Lessons loading (ANA-116)", () => {
    it("loads Lessons from the existing Lesson list API for the selected Module", async () => {
      mockFetch({
        lessons: [
          buildLessonFixture({
            id: "lesson-1",
            title: { ar: "Introduction", en: "" },
          }),
        ],
      });
      renderModal();

      await screen.findByText("Introduction");

      const getCalls = (
        (fetch as ReturnType<typeof vi.fn>).mock.calls as [
          string,
          RequestInit?,
        ][]
      ).filter(
        ([url, init]) =>
          url === "/api/v1/books/book-1/modules/module-1/lessons" &&
          (init?.method ?? "GET").toUpperCase() === "GET",
      );
      expect(getCalls).toHaveLength(1);
    });

    it("shows a loading state while Lessons are loading", async () => {
      let resolveLessons: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const method = (init?.method ?? "GET").toUpperCase();
          if (
            typeof url === "string" &&
            url.endsWith("/lessons") &&
            method === "GET"
          ) {
            return new Promise((resolve) => (resolveLessons = resolve));
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("status", { name: "Loading lessons" }),
      ).toBeInTheDocument();

      resolveLessons(jsonResponse({ data: [] }));

      await within(dialog).findByText("This module has no lessons yet.");
    });

    it("shows an explicit error state if Lesson loading fails, without blocking the rest of the modal", async () => {
      mockFetch({ other: {}, otherStatus: 200 });
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const method = (init?.method ?? "GET").toUpperCase();
          if (
            typeof url === "string" &&
            url.endsWith("/lessons") &&
            method === "GET"
          ) {
            return Promise.resolve(
              jsonResponse({ error: "Something went wrong." }, 500),
            );
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        await within(dialog).findByText("Something went wrong."),
      ).toBeInTheDocument();
      // The Module editor itself is unaffected by a Lessons load failure.
      expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");
    });
  });

  describe("Module mode Lessons list (ANA-111/ANA-115/ANA-116)", () => {
    const LESSONS: Lesson[] = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "Introduction", en: "" },
      }),
      buildLessonFixture({
        id: "lesson-2",
        title: { ar: "Prayer basics", en: "" },
        type: "video",
        position: 1,
        isPublished: true,
      }),
    ];

    function renderWithLessons(overrides: Partial<EditModuleModalProps> = {}) {
      mockFetch({ lessons: LESSONS });
      return renderModal(overrides);
    }

    it("shows the Module editor and Lessons list together (never a third, simultaneous Lesson editor)", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(within(dialog).getByLabelText("Title")).toBeInTheDocument();
      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(
        await within(dialog).findByText("Introduction"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Back to Module" }),
      ).not.toBeInTheDocument();
    });

    it("does not render the Lessons list in create mode", async () => {
      renderModal({ state: { mode: "create" } });

      const dialog = await screen.findByRole("dialog", { name: "Add Module" });
      expect(within(dialog).queryByText("Lessons")).not.toBeInTheDocument();
    });

    it("renders Lessons in the loaded order", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      const rows = within(dialog).getAllByTestId(/^list-item-/);
      expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
        "list-item-lesson-1",
        "list-item-lesson-2",
      ]);
    });

    it("shows the Lessons empty state and no rows when the Module has no Lessons", async () => {
      mockFetch({ lessons: [] });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        await within(dialog).findByText("This module has no lessons yet."),
      ).toBeInTheDocument();
    });

    it("exposes Edit and Delete actions on every row, matching the Modules list pattern", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        await within(dialog).findByRole("button", {
          name: "Edit Introduction",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      ).toBeInTheDocument();
    });

    it("a single click on a Lesson row no longer opens its form (Edit is the only entry point)", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(within(dialog).getByText("Introduction"));

      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
    });

    it("reorders Lessons locally via the Lessons list, without a persistence request", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      const callsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      const grip = within(dialog)
        .getByTestId("list-item-lesson-2")
        .querySelector("[aria-hidden='true']") as HTMLElement;

      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      // Escaping a keyboard drag cancels it without reordering -- this only
      // confirms drag activation is wired through, and that neither
      // activating nor cancelling it ever calls the backend.
      fireEvent.keyDown(grip, { code: "Escape", key: "Escape" });

      expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        callsBefore,
      );
    });

    it("persists a completed Lesson reorder as `lessonsOrder` when the Module is saved (ANA-117)", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderWithLessons({ onSave });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      stubItemRects(["lesson-1", "lesson-2"]);
      const grip = within(dialog)
        .getByTestId("list-item-lesson-2")
        .querySelector("[aria-hidden='true']") as HTMLElement;

      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
      fireEvent.keyDown(grip, { code: "Space", key: " " });

      await within(dialog).findByTestId("list-item-lesson-2");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith("module-1", expect.anything(), [
          "lesson-2",
          "lesson-1",
        ]),
      );
    });

    it("shows the just-saved Lesson order immediately on reopen, before the follow-up GET resolves (PR review regression)", async () => {
      const LESSONS: Lesson[] = [
        buildLessonFixture({
          id: "lesson-1",
          title: { ar: "Introduction", en: "" },
        }),
        buildLessonFixture({
          id: "lesson-2",
          title: { ar: "Prayer basics", en: "" },
          position: 1,
        }),
      ];
      mockFetch({ lessons: LESSONS });
      const onSave = vi.fn().mockResolvedValue(undefined);

      // A single, persistent SWRConfig cache shared across close/reopen --
      // mirrors the real app's single long-lived SWR cache (only tests
      // reset it per render). `EditModuleModal` itself unmounts/remounts
      // its body between `state`/`null`/`state` (see its own `{state &&
      // ...}` guard), exactly like a real close-then-reopen -- this Harness
      // only supplies the `state` toggle a real page would.
      function Harness() {
        const [state, setState] = useState<EditModuleModalState | null>({
          mode: "edit",
          id: "module-1",
          fields: EDIT_FIELDS,
        });
        return (
          <>
            <EditModuleModal
              state={state}
              book={BOOK}
              onClose={() => setState(null)}
              onCreate={vi.fn()}
              onSave={onSave}
            />
            <button
              onClick={() =>
                setState({ mode: "edit", id: "module-1", fields: EDIT_FIELDS })
              }
            >
              Reopen
            </button>
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

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      stubItemRects(["lesson-1", "lesson-2"]);
      const grip = within(dialog)
        .getByTestId("list-item-lesson-2")
        .querySelector("[aria-hidden='true']") as HTMLElement;

      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await within(dialog).findByTestId("list-item-lesson-2");

      // From this point on, the Lessons GET never resolves -- proves the
      // reopened modal's correct order comes from the SWR cache being
      // promoted on save, not from a background refetch that happened to
      // race ahead of the assertion below.
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const method = (init?.method ?? "GET").toUpperCase();
          if (
            typeof url === "string" &&
            url.endsWith("/lessons") &&
            method === "GET"
          ) {
            return new Promise(() => {});
          }
          return Promise.resolve(jsonResponse({}, 200));
        },
      );

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
      await vi.waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Edit Module" }),
        ).not.toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      const reopenedDialog = await screen.findByRole("dialog", {
        name: "Edit Module",
      });
      const rows = within(reopenedDialog).getAllByTestId(/^list-item-/);
      expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
        "list-item-lesson-2",
        "list-item-lesson-1",
      ]);
    });

    it("New Lesson switches into Lesson mode with a blank, id-less draft and makes no create request", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      const callsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );

      expect(within(dialog).getByTestId("lesson-form")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Title")).toHaveValue("");
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        callsBefore,
      );
    });

    it("backing out of New Lesson without saving adds nothing to the Lessons list and makes no request", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      const callsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(within(dialog).getByText("2 lessons")).toBeInTheDocument();
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        callsBefore,
      );
    });

    it("Saving a New Lesson POSTs exactly once with the visible fields plus the temporary hidden defaults, then returns to Module mode showing it (ANA-116)", async () => {
      const created = buildLessonFixture({
        id: "lesson-3",
        title: { ar: "New lesson title", en: "" },
      });
      mockFetch({
        lessons: LESSONS,
        other: { data: created },
        otherStatus: 201,
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "New lesson title" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await within(dialog).findByText("3 lessons");
      expect(within(dialog).getByText("New lesson title")).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();

      const posts = mutationCalls().filter(
        ([, init]) => init?.method === "POST",
      );
      expect(posts).toHaveLength(1);
      expect(posts[0][0]).toBe("/api/v1/books/book-1/modules/module-1/lessons");
      const body = JSON.parse(posts[0][1].body as string);
      expect(body).toEqual({
        title: { ar: "New lesson title", en: "" },
        description: { ar: "", en: "" },
        type: "text",
        position: 2,
        isPublished: false,
        content: { ar: "", en: "" },
        videoURL: "",
        duration: 0,
        azkar: [],
        reward: { coins: 0 },
        questions: [],
        isLocked: false,
      });
    });

    it("a successful create still shows the new Lesson even when the follow-up list revalidation fails (ANA-116)", async () => {
      const created = buildLessonFixture({
        id: "lesson-3",
        title: { ar: "New lesson title", en: "" },
      });
      let lessonsGetCount = 0;
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const method = (init?.method ?? "GET").toUpperCase();
          if (
            typeof url === "string" &&
            url.endsWith("/lessons") &&
            method === "GET"
          ) {
            lessonsGetCount += 1;
            return lessonsGetCount === 1
              ? Promise.resolve(jsonResponse({ data: LESSONS }))
              : Promise.resolve(
                  jsonResponse({ error: "Refresh failed." }, 500),
                );
          }
          if (
            typeof url === "string" &&
            url.endsWith("/lessons") &&
            method === "POST"
          ) {
            return Promise.resolve(jsonResponse({ data: created }, 201));
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "New Lesson" }),
      );
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "New lesson title" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      // The write succeeded and is reflected immediately -- a background
      // revalidation failure that happens afterward must never retroactively
      // make it look like the write itself failed.
      expect(
        await within(dialog).findByText("New lesson title"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("3 lessons")).toBeInTheDocument();
    });

    it("Delete removes only the selected Lesson after confirmation, calling DELETE exactly once (ANA-116)", async () => {
      mockFetch({ lessons: LESSONS, other: { ok: true } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      );
      // The delete confirmation is a separate Modal, not nested inside the
      // Edit Module dialog's own DOM subtree -- unscoped, matching
      // lessons-panel.test.tsx's identical interaction.
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      await within(dialog).findByText("1 lesson");
      expect(
        within(dialog).queryByText("Introduction"),
      ).not.toBeInTheDocument();
      expect(within(dialog).getByText("Prayer basics")).toBeInTheDocument();

      const deletes = mutationCalls().filter(
        ([, init]) => init?.method === "DELETE",
      );
      expect(deletes).toHaveLength(1);
      expect(deletes[0][0]).toBe(
        "/api/v1/books/book-1/modules/module-1/lessons/lesson-1",
      );
    });

    it("keeps the Lesson visible and shows the error when Delete fails", async () => {
      mockFetch({
        lessons: LESSONS,
        other: { error: "Lesson not found." },
        otherStatus: 404,
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

      expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
      expect(within(dialog).getByText("Introduction")).toBeInTheDocument();
    });

    it("Cancel on the delete confirmation leaves the Lesson in the list, with no DELETE call", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete Introduction" }),
      );
      const confirmDialog = screen.getByRole("dialog", {
        name: "Delete lesson?",
      });
      fireEvent.click(
        within(confirmDialog).getByRole("button", { name: "Cancel" }),
      );

      expect(within(dialog).getByText("Introduction")).toBeInTheDocument();
      expect(within(dialog).getByText("2 lessons")).toBeInTheDocument();
      expect(
        mutationCalls().filter(([, init]) => init?.method === "DELETE"),
      ).toHaveLength(0);
    });
  });

  describe("Lesson mode (ANA-115, wired to the real backend in ANA-116)", () => {
    const LESSONS: Lesson[] = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "Introduction", en: "" },
        description: { ar: "Short intro", en: "" },
      }),
      buildLessonFixture({
        id: "lesson-2",
        title: { ar: "Prayer basics", en: "" },
        type: "video",
        position: 3,
        isPublished: true,
      }),
    ];

    function renderWithLessons(overrides: Partial<EditModuleModalProps> = {}) {
      mockFetch({ lessons: LESSONS });
      return renderModal(overrides);
    }

    async function openLesson(dialog: HTMLElement, label: string) {
      fireEvent.click(
        await within(dialog).findByRole("button", { name: `Edit ${label}` }),
      );
      return within(dialog).getByTestId("lesson-form");
    }

    it("switches from Module mode to Lesson mode when Edit is clicked, replacing the Module editor/Lessons list entirely", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await openLesson(dialog, "Introduction");

      expect(within(dialog).queryByText("Lessons")).not.toBeInTheDocument();
      // Only one "Description" field remains, and it's the Lesson's own
      // (ANA-118 renamed Lesson's field from "One-line description" to
      // "Description", the same label the Module form's own field already
      // used) -- the Module form's own field is gone, not layered behind/
      // alongside it, so its own value ("وصف") is nowhere on the page.
      expect(within(dialog).getAllByLabelText("Description")).toHaveLength(1);
      expect(within(dialog).getByLabelText("Description")).toHaveValue(
        "Short intro",
      );
      expect(within(dialog).queryByDisplayValue("وصف")).not.toBeInTheDocument();
      // Only the Lesson's own "Title" input remains -- the Module form's own
      // Title field is gone, not layered behind/alongside it.
      expect(within(dialog).getAllByLabelText("Title")).toHaveLength(1);
      expect(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      ).toBeInTheDocument();
    });

    it("seeds the Lesson editor from the clicked Lesson's fields", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      expect(form.getByDisplayValue("Introduction")).toBeInTheDocument();
      expect(form.getByDisplayValue("Short intro")).toBeInTheDocument();
      expect(form.getByRole("switch", { name: "Published" })).not.toBeChecked();
      expect(
        form.getByRole("radio", { name: "0", checked: true }),
      ).toBeInTheDocument();
    });

    it("Back to Module returns to Module mode without closing the modal", async () => {
      const onClose = vi.fn();
      renderWithLessons({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await openLesson(dialog, "Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(within(dialog).getByText("Lessons")).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("preserves an unsaved Module field edit across entering and leaving Lesson mode", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "Module title, edited" },
      });

      await openLesson(dialog, "Introduction");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );

      expect(
        within(dialog).getByDisplayValue("Module title, edited"),
      ).toBeInTheDocument();
    });

    it("editing one Lesson never leaks into another's fields", async () => {
      renderWithLessons();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      let form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );
      // The discard confirmation is a separate Modal, not nested inside the
      // Edit Module dialog's own DOM subtree -- unscoped, matching
      // lesson-editor.test.tsx's identical interaction.
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      form = within(await openLesson(dialog, "Prayer basics"));
      expect(
        form.queryByDisplayValue("Introduction, edited"),
      ).not.toBeInTheDocument();
      expect(form.getByDisplayValue("Prayer basics")).toBeInTheDocument();
    });

    it("Save changes PATCHes this Lesson's visible fields (never the still-hidden ones), then returns to Module mode with the update reflected (ANA-116/ANA-118)", async () => {
      const updated = {
        ...LESSONS[0],
        title: { ar: "Introduction, edited", en: "" },
      };
      mockFetch({ lessons: LESSONS, other: { data: updated } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await within(dialog).findByText("Introduction, edited");
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      // The Module form's own Title is untouched by the Lesson save.
      expect(within(dialog).getByLabelText("Title")).toHaveValue("المقدمة");

      const patches = mutationCalls().filter(
        ([, init]) => init?.method === "PATCH",
      );
      expect(patches).toHaveLength(1);
      expect(patches[0][0]).toBe(
        "/api/v1/books/book-1/modules/module-1/lessons/lesson-1",
      );
      const body = JSON.parse(patches[0][1].body as string);
      expect(body).toEqual({
        title: { ar: "Introduction, edited", en: "" },
        description: { ar: "Short intro", en: "" },
        type: "text",
        position: 0,
        isPublished: false,
        content: { ar: "", en: "" },
        videoURL: "",
        duration: 0,
        azkar: [],
        // `questions` (ANA-119) is always included, like `azkar`/`videoURL`
        // -- this Lesson has none, so it's sent as an empty array, never
        // omitted.
        questions: [],
      });
      expect(body).not.toHaveProperty("reward");
      expect(body).not.toHaveProperty("isLocked");
    });

    it("editing one Lesson never affects the other Lesson's saved fields", async () => {
      const updated = {
        ...LESSONS[0],
        title: { ar: "Introduction, edited", en: "" },
      };
      mockFetch({ lessons: LESSONS, other: { data: updated } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "Introduction, edited" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        await within(dialog).findByText("Introduction, edited"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Prayer basics")).toBeInTheDocument();
    });

    it("translates Title through the plain translation endpoint only, never a Lesson persistence request", async () => {
      mockFetch({
        lessons: LESSONS,
        other: { data: { text: "Translated" } },
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      fireEvent.click(
        form.getByRole("button", { name: "Translate Title with AI" }),
      );

      await vi.waitFor(() => expect(mutationCalls()).toHaveLength(1));
      const [url, init] = mutationCalls()[0];
      expect(url).toBe("/api/v1/ai/translate");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      // The plain, context-free translation body -- no `field`/`bookId`
      // Module-scoped context, unlike Module Title's own translate request.
      expect(body).toEqual({ text: "Introduction" });
    });
  });

  describe("Questions editor persistence (ANA-119)", () => {
    const QUESTION_1 = buildQuestionFixture({
      id: "question-1",
      text: { ar: "سؤال أول", en: "First question" },
    });
    const QUESTION_2 = buildQuestionFixture({
      id: "question-2",
      text: { ar: "سؤال ثاني", en: "Second question" },
    });
    const QUIZ_LESSON: Lesson = buildLessonFixture({
      id: "lesson-1",
      title: { ar: "اختبار", en: "" },
      type: "quiz",
      questions: [QUESTION_2.id, QUESTION_1.id],
    });

    async function openQuizLesson() {
      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        await within(dialog).findByRole("button", { name: "Edit اختبار" }),
      );
      const form = within(within(dialog).getByTestId("lesson-form"));
      return { dialog, form };
    }

    it("loads existing referenced Questions in Lesson.questions order", async () => {
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
      });
      renderModal();

      const { form } = await openQuizLesson();

      const textareas = form.getAllByRole("textbox", { name: "Question" });
      // `Lesson.questions` is [question-2, question-1] -- the opposite of
      // `questions`' own insertion order above.
      expect((textareas[0] as HTMLTextAreaElement).value).toContain(
        "سؤال ثاني",
      );
      expect((textareas[1] as HTMLTextAreaElement).value).toContain("سؤال أول");
    });

    it("PATCHes an edited, existing Question and keeps its id in Lesson.questions on Save", async () => {
      const updatedLesson = { ...QUIZ_LESSON };
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
        other: { data: updatedLesson },
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      const [firstTextarea] = form.getAllByRole("textbox", {
        name: "Question",
      });
      fireEvent.change(firstTextarea, {
        target: { value: "سؤال ثاني معدّل" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );

      const [, patchInit] = mutationCalls().find(([url]) =>
        url.endsWith("/questions/question-2"),
      )!;
      const patchBody = JSON.parse(patchInit.body as string);
      // Editing only the Arabic buffer leaves the already-loaded English
      // side untouched.
      expect(patchBody.text).toEqual({
        ar: "سؤال ثاني معدّل",
        en: "Second question",
      });

      const lessonPatch = mutationCalls().find(
        ([url, init]) =>
          url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
      )!;
      const lessonBody = JSON.parse(lessonPatch[1].body as string);
      expect(lessonBody.questions).toEqual(["question-2", "question-1"]);

      // question-1 was never touched -- it's reused as-is, never re-PATCHed
      // merely because the Lesson itself was saved.
      expect(
        mutationCalls().some(([url]) => url.endsWith("/questions/question-1")),
      ).toBe(false);
    });

    it("never re-PATCHes an existing Question that wasn't edited when the Lesson is saved", async () => {
      const updatedLesson = { ...QUIZ_LESSON };
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
        other: { data: updatedLesson },
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      // Edit only the Lesson's own Title -- neither Question is touched.
      fireEvent.change(form.getByLabelText("Title"), {
        target: { value: "اختبار معدّل" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );

      expect(
        mutationCalls().some(
          ([url, init]) =>
            url.includes("/questions/") && init.method === "PATCH",
        ),
      ).toBe(false);

      const lessonPatch = mutationCalls().find(
        ([url, init]) =>
          url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
      )!;
      const lessonBody = JSON.parse(lessonPatch[1].body as string);
      // The unedited Questions' ids still round-trip into the save.
      expect(lessonBody.questions).toEqual(["question-2", "question-1"]);
    });

    it("POSTs new Question drafts on Save and stores the returned ids in Lesson.questions", async () => {
      const updatedLesson = { ...QUIZ_LESSON, questions: [] };
      mockFetch({
        lessons: [{ ...QUIZ_LESSON, questions: [] }],
        other: { data: updatedLesson },
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      fireEvent.click(form.getByRole("button", { name: "New" }));
      const [textarea] = form.getAllByRole("textbox", { name: "Question" });
      fireEvent.change(textarea, { target: { value: "سؤال جديد" } });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );

      const [, postInit] = mutationCalls().find(
        ([url, init]) => url.endsWith("/questions") && init.method === "POST",
      )!;
      const postBody = JSON.parse(postInit.body as string);
      expect(postBody.text).toEqual({ ar: "سؤال جديد", en: "" });

      const lessonPatch = mutationCalls().find(
        ([url, init]) =>
          url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
      )!;
      const lessonBody = JSON.parse(lessonPatch[1].body as string);
      // The auto-echoed POST response's synthesized id lands in the
      // Lesson's own `questions` id list.
      expect(lessonBody.questions).toEqual(["question-1"]);
    });

    it("persists a reorder through the Question id order on the Lesson", async () => {
      const updatedLesson = { ...QUIZ_LESSON };
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
        other: { data: updatedLesson },
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();

      // Each Question card's `data-testid` is keyed by its own client-only
      // `key` (a random uuid, see question-fields.ts), never the linked
      // Question's real id -- read the actual rendered order rather than
      // predicting it.
      const cardTestIds = form
        .getAllByTestId(/^question-card-/)
        .map((card) => card.getAttribute("data-testid") ?? "");
      stubItemRects(
        cardTestIds.map((testId) => testId.replace("question-card-", "")),
      );

      const grip = form.getByRole("button", { name: "Reorder question 2" });
      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
      fireEvent.keyDown(grip, { code: "Space", key: " " });

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );
      const lessonPatch = mutationCalls().find(
        ([url, init]) =>
          url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
      )!;
      const lessonBody = JSON.parse(lessonPatch[1].body as string);
      // Loaded order was [question-2, question-1] -- moving the second card
      // up one position swaps them.
      expect(lessonBody.questions).toEqual(["question-1", "question-2"]);
    });

    it("detaches a removed existing Question from Lesson.questions without deleting its document", async () => {
      const updatedLesson = { ...QUIZ_LESSON, questions: [QUESTION_1.id] };
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
        other: { data: updatedLesson },
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      fireEvent.click(form.getByRole("button", { name: "Remove question 1" }));
      const confirmDialog = screen.getByRole("dialog", {
        name: "Delete question 1?",
      });
      fireEvent.click(
        within(confirmDialog).getByRole("button", { name: "Delete" }),
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );
      const lessonPatch = mutationCalls().find(
        ([url, init]) =>
          url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
      )!;
      const lessonBody = JSON.parse(lessonPatch[1].body as string);
      expect(lessonBody.questions).toEqual(["question-1"]);

      // The Module-level Question document is never DELETEd by removing it
      // from this Lesson's local list -- only the reference is dropped.
      expect(mutationCalls().some(([, init]) => init.method === "DELETE")).toBe(
        false,
      );
    });

    it("keeps the Lesson editor open with the draft intact when a Question save fails", async () => {
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
        questionOther: { error: "Question is still referenced." },
        questionOtherStatus: 409,
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      const [firstTextarea] = form.getAllByRole("textbox", {
        name: "Question",
      });
      fireEvent.change(firstTextarea, {
        target: { value: "سؤال ثاني معدّل" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      expect(
        await within(dialog).findByText("Question is still referenced."),
      ).toBeInTheDocument();
      // Still in Lesson mode, draft intact -- never silently returned to
      // Module mode.
      expect(within(dialog).getByTestId("lesson-form")).toBeInTheDocument();
      expect((firstTextarea as HTMLTextAreaElement).value).toContain(
        "سؤال ثاني معدّل",
      );
      // No Lesson request was ever made -- Questions are saved first.
      expect(
        mutationCalls().some(
          ([url, init]) =>
            url.endsWith("/lessons/lesson-1") && init.method === "PATCH",
        ),
      ).toBe(false);
    });

    it("blocks opening an existing Lesson's editor when Questions fail to load, never silently treating its questions as empty (PR review)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : String(url);
          const method = (init?.method ?? "GET").toUpperCase();

          if (urlStr.endsWith("/lessons") && method === "GET") {
            return Promise.resolve(jsonResponse({ data: [QUIZ_LESSON] }));
          }
          if (urlStr.endsWith("/questions") && method === "GET") {
            return Promise.resolve(
              jsonResponse({ error: "Failed to load Questions." }, 500),
            );
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        await within(dialog).findByRole("button", { name: "Edit اختبار" }),
      );

      // The Lesson editor's own form never renders -- opening it would
      // hydrate this Lesson's real `questions` ids as `[]` (Questions never
      // loaded), and saving any other field would then PATCH
      // `questions: []`, silently detaching every one of them.
      expect(
        await within(dialog).findByText("Failed to load Questions."),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Retry" }),
      ).toBeInTheDocument();
    });

    it("opens the Lesson editor with real Question content once Retry succeeds", async () => {
      let questionsCallCount = 0;
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : String(url);
          const method = (init?.method ?? "GET").toUpperCase();

          if (urlStr.endsWith("/lessons") && method === "GET") {
            return Promise.resolve(jsonResponse({ data: [QUIZ_LESSON] }));
          }
          if (urlStr.endsWith("/questions") && method === "GET") {
            questionsCallCount += 1;
            if (questionsCallCount === 1) {
              return Promise.resolve(
                jsonResponse({ error: "Failed to load Questions." }, 500),
              );
            }
            return Promise.resolve(
              jsonResponse({ data: [QUESTION_1, QUESTION_2] }),
            );
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        await within(dialog).findByRole("button", { name: "Edit اختبار" }),
      );
      await within(dialog).findByText("Failed to load Questions.");

      fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

      expect(
        await within(dialog).findByTestId("lesson-form"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getAllByRole("textbox", { name: "Question" }),
      ).toHaveLength(2);
    });

    it("does not duplicate an already-created Question draft when Save is retried after a later Question fails (PR review)", async () => {
      const emptyQuizLesson: Lesson = { ...QUIZ_LESSON, questions: [] };
      let questionPostCount = 0;

      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: RequestInfo | URL, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : String(url);
          const method = (init?.method ?? "GET").toUpperCase();

          if (urlStr.endsWith("/lessons") && method === "GET") {
            return Promise.resolve(jsonResponse({ data: [emptyQuizLesson] }));
          }
          if (urlStr.endsWith("/questions") && method === "GET") {
            return Promise.resolve(jsonResponse({ data: [] }));
          }
          if (urlStr.endsWith("/questions") && method === "POST") {
            questionPostCount += 1;
            // The *second* Question's own POST fails the first time only --
            // the first Question has already succeeded by then.
            if (questionPostCount === 2) {
              return Promise.resolve(
                jsonResponse({ error: "Question create failed." }, 500),
              );
            }
            const body = JSON.parse(init?.body as string) as {
              text: unknown;
              explanation: unknown;
              choices: unknown;
            };
            return Promise.resolve(
              jsonResponse(
                {
                  data: {
                    id: `question-new-${questionPostCount}`,
                    text: body.text,
                    explanation: body.explanation,
                    choices: body.choices,
                    createdAt: new Date(0).toISOString(),
                    updatedAt: new Date(0).toISOString(),
                    createdBy: "a@example.com",
                    updatedBy: "a@example.com",
                  },
                },
                201,
              ),
            );
          }
          if (urlStr.endsWith("/lessons/lesson-1") && method === "PATCH") {
            return Promise.resolve(jsonResponse({ data: emptyQuizLesson }));
          }
          return Promise.resolve(
            jsonResponse({ error: "Unhandled fetch in test." }, 500),
          );
        },
      );
      renderModal();

      const { dialog, form } = await openQuizLesson();
      fireEvent.click(form.getByRole("button", { name: "New" }));
      fireEvent.click(form.getByRole("button", { name: "New" }));
      const textareas = form.getAllByRole("textbox", { name: "Question" });
      fireEvent.change(textareas[0], { target: { value: "سؤال أول" } });
      fireEvent.change(textareas[1], { target: { value: "سؤال ثاني" } });

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      // First attempt: the first Question's own POST succeeds, the
      // second's fails -- the editor stays open showing the error, with
      // both drafts (including the already-created one) still there.
      expect(
        await within(dialog).findByText("Question create failed."),
      ).toBeInTheDocument();
      expect(within(dialog).getByTestId("lesson-form")).toBeInTheDocument();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByTestId("lesson-form")).not.toBeInTheDocument(),
      );

      const questionPosts = (
        fetch as ReturnType<typeof vi.fn>
      ).mock.calls.filter(([url, init]) => {
        const urlStr = typeof url === "string" ? url : String(url);
        const method = ((init as RequestInit)?.method ?? "GET").toUpperCase();
        return urlStr.endsWith("/questions") && method === "POST";
      }) as [string, RequestInit][];
      const firstQuestionPosts = questionPosts.filter((call) => {
        const body = JSON.parse(call[1].body as string) as {
          text: { ar: string };
        };
        return body.text.ar === "سؤال أول";
      });

      // The already-succeeded first Question is never POSTed again by the
      // retry -- its draft was promoted to its real id the moment it
      // originally succeeded, so the retry only re-attempts the second one.
      expect(firstQuestionPosts).toHaveLength(1);
    });

    it("discarding a Question edit leaves backend data unchanged", async () => {
      mockFetch({
        lessons: [QUIZ_LESSON],
        questions: [QUESTION_1, QUESTION_2],
      });
      renderModal();

      const { dialog, form } = await openQuizLesson();
      const [firstTextarea] = form.getAllByRole("textbox", {
        name: "Question",
      });
      fireEvent.change(firstTextarea, {
        target: { value: "سؤال ثاني معدّل" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Back to Module" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(mutationCalls()).toHaveLength(0);
    });
  });

  describe("Lesson AI Suggest context reflects the live, unsaved Module draft (ANA-116)", () => {
    const LESSONS: Lesson[] = [
      buildLessonFixture({
        id: "lesson-1",
        title: { ar: "Introduction", en: "" },
        description: { ar: "Short intro", en: "" },
      }),
    ];

    async function openLesson(dialog: HTMLElement, label: string) {
      fireEvent.click(
        await within(dialog).findByRole("button", { name: `Edit ${label}` }),
      );
      return within(dialog).getByTestId("lesson-form");
    }

    it("Lesson Title exposes both Translate and AI Assistance", async () => {
      mockFetch({ lessons: LESSONS });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      expect(
        form.getByRole("button", { name: "Translate Title with AI" }),
      ).toBeInTheDocument();
      expect(
        form.getByRole("button", { name: "AI Assistance for Title" }),
      ).toBeInTheDocument();
    });

    it("Lesson Description exposes both Translate and AI Assistance", async () => {
      mockFetch({ lessons: LESSONS });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));

      expect(
        form.getByRole("button", {
          name: "Translate Description with AI",
        }),
      ).toBeInTheDocument();
      expect(
        form.getByRole("button", {
          name: "AI Assistance for Description",
        }),
      ).toBeInTheDocument();
    });

    it("grounds Lesson Title's AI Assistance in unsaved Module Title/Description/Content edits, not the last-saved values", async () => {
      mockFetch({ lessons: LESSONS, other: { data: { text: "اقتراح" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "وحدة معدلة" },
      });
      fireEvent.change(within(dialog).getByLabelText("Description"), {
        target: { value: "وصف معدل" },
      });

      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.click(
        form.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        field: "lessonTitle",
        text: "Introduction",
        moduleTitle: "وحدة معدلة",
        moduleDescription: "وصف معدل",
        moduleContent: "محتوى",
      });
    });

    it("grounds Lesson Description's AI Assistance in the same live Module context", async () => {
      mockFetch({ lessons: LESSONS, other: { data: { text: "اقتراح" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.click(
        form.getByRole("button", {
          name: "AI Assistance for Description",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        field: "lessonDescription",
        text: "Short intro",
        moduleTitle: "المقدمة",
        moduleDescription: "وصف",
        moduleContent: "محتوى",
      });
    });

    it("applies a Title suggestion only to Title, never Description (concurrent AI responses can't overwrite unrelated fields)", async () => {
      mockFetch({
        lessons: LESSONS,
        other: { data: { text: "اقتراح للعنوان" } },
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      fireEvent.click(
        form.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await form.findByDisplayValue("اقتراح للعنوان"),
      ).toBeInTheDocument();
      expect(form.getByDisplayValue("Short intro")).toBeInTheDocument();
    });

    it("keeps Save disabled while a Lesson suggestion request is pending", async () => {
      mockFetch({ lessons: LESSONS });
      let resolveAssist: (value: Response) => void = () => {};
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      const form = within(await openLesson(dialog, "Introduction"));
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveAssist = resolve)),
      );

      fireEvent.click(
        form.getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).toBeDisabled(),
      );

      resolveAssist(jsonResponse({ data: { text: "اقتراح" } }));

      await vi.waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).not.toBeDisabled(),
      );
    });
  });

  describe("AI busy is scoped to the active field (ANA-109)", () => {
    it("disables only Title while its Translate request is running, and re-enables it once it resolves", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).toBeDisabled();
      });
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      expect(getContentEditable(dialog)).toHaveAttribute(
        "contenteditable",
        "true",
      );
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
      expect(
        within(dialog).getByRole("radiogroup", { name: "Color" }),
      ).not.toHaveAttribute("aria-disabled", "true");
      // Save stays disabled while Title's own translation is unresolved --
      // unlike Description/Content/Color, it isn't "a field this AI request
      // has nothing to do with": saving now would persist Title's
      // pre-translation value, and the AI result would be lost once it
      // resolves after this component has already unmounted (PR review).
      // Cancel is unaffected -- discarding the draft is always safe.
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).not.toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("disables only Description while its Translate request is running", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Description with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Description")).toBeDisabled();
      });
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(getContentEditable(dialog)).toHaveAttribute(
        "contenteditable",
        "true",
      );
      // Save is still gated on Description's own in-flight request, even
      // though Description itself is the only field disabled.
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Description" } }));

      await vi.waitFor(() => {
        expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("disables only Content while its Translate request is running", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(getContentEditable(dialog)).toHaveAttribute(
          "contenteditable",
          "false",
        );
      });
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
      expect(
        within(dialog).getByRole("combobox", { name: "Color" }),
      ).not.toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeDisabled();

      resolveTranslate(jsonResponse({ data: { text: "Content" } }));

      await vi.waitFor(() => {
        expect(getContentEditable(dialog)).toHaveAttribute(
          "contenteditable",
          "true",
        );
      });
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).not.toBeDisabled();
    });

    it("does not persist the pre-translation value when Save is clicked while Translate is still in flight (PR review regression)", async () => {
      let resolveTranslate: (value: Response) => void = () => {};
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => (resolveTranslate = resolve)),
      );
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onSave, onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => {
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).toBeDisabled();
      });

      // A disabled native button ignores clicks -- Save must not have
      // persisted the still-untranslated Title while its own AI result was
      // unresolved.
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      resolveTranslate(jsonResponse({ data: { text: "Introduction" } }));
      await vi.waitFor(() => {
        expect(
          within(dialog).getByRole("button", { name: "Save changes" }),
        ).not.toBeDisabled();
      });

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save changes" }),
      );
      await vi.waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "module-1",
          expect.objectContaining({
            title: expect.objectContaining({ en: "Introduction" }),
          }),
          null,
        ),
      );
    });

    it("re-enables Title even when its Translate request fails, leaving other fields untouched throughout", async () => {
      mockFetch({
        other: { error: "Something went wrong." },
        otherStatus: 500,
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await within(dialog).findByText("Something went wrong.");
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
      expect(within(dialog).getByLabelText("Description")).not.toBeDisabled();
    });

    it("re-enables Title even when its AI Assistance request fails", async () => {
      mockFetch({
        other: { error: "Something went wrong." },
        otherStatus: 500,
      });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Title",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await within(dialog).findByText("Something went wrong.");
      expect(within(dialog).getByLabelText("Title")).not.toBeDisabled();
    });
  });

  describe("AI Assistance opens Additional Instructions; Translate with AI runs directly (ANA-98)", () => {
    it("never calls fetch until Generate is clicked, for AI Assistance", async () => {
      mockFetch({ other: { data: { text: "Result" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });

      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Title",
        }),
      );
      await screen.findByRole("dialog", { name: "AI Assistance" });
      expect(mutationCalls()).toHaveLength(0);
    });

    it("calls fetch immediately for Translate with AI, without ever showing Additional Instructions", async () => {
      mockFetch({ other: { data: { text: "Result" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });

      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(
        screen.queryByRole("dialog", { name: "Translate with AI" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Module Title AI context (ANA-98)", () => {
    it("sends Module Content plus Book title/description/longDescription for AI Assistance", async () => {
      mockFetch({ other: { data: { text: "Suggested title" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/ai/assist",
        expect.objectContaining({ method: "POST" }),
      );
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "title",
        text: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("sends Module Content for Translate with AI", async () => {
      mockFetch({ other: { data: { text: "Introduction" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );
      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "title",
        text: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("applies the AI Assistance result to the active Title language", async () => {
      mockFetch({ other: { data: { text: "Suggested title" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByDisplayValue("Suggested title"),
      ).toBeInTheDocument();
    });
  });

  describe("Module Description AI context (ANA-98)", () => {
    it("sends Module Title, Module Content, and Book context for AI Assistance", async () => {
      mockFetch({ other: { data: { text: "وصف محسّن" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Description",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "description",
        text: "وصف",
        moduleTitle: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("sends Module Title and Module Content for Translate with AI", async () => {
      mockFetch({ other: { data: { text: "Description" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Description with AI",
        }),
      );
      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "description",
        text: "وصف",
        moduleTitle: "المقدمة",
        moduleContent: "محتوى",
      });
    });

    it("applies the AI Assistance result to the active Description language", async () => {
      mockFetch({ other: { data: { text: "وصف محسّن" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Description",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByDisplayValue("وصف محسّن"),
      ).toBeInTheDocument();
    });
  });

  describe("Module Content AI context (ANA-98)", () => {
    it("exposes both AI Assistance and Translate with AI (previously missing)", async () => {
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      expect(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      ).toBeInTheDocument();
    });

    it("sends Module Title, Module Description, and Book context for AI Assistance", async () => {
      mockFetch({ other: { data: { text: "محتوى محسّن" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      // assistLearningMaterial (the existing ANA-85 client fn, reused here
      // unchanged for backward compatibility -- see ai-assist-client.ts)
      // never sends an explicit `field` key; the server treats an omitted
      // `field` as `"content"`, its default.
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        text: "محتوى",
        moduleTitle: "المقدمة",
        moduleDescription: "وصف",
      });
      expect(lastRequestBody()).not.toHaveProperty("field");
      // No selection was made, so `text` already is the whole field --
      // fullMaterial is omitted rather than duplicating it (ANA-99).
      expect(lastRequestBody()).not.toHaveProperty("fullMaterial");
    });

    it("sends the full Content field as fullMaterial context, separate from the selected target, when AI Assistance runs on a Markdown selection (ANA-99)", async () => {
      mockFetch({ other: { data: { text: "جزء محسّن" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      // Title and Description are plain text inputs (also role "textbox");
      // the Content field's own contenteditable Markdown editor -- the
      // only one with a non-empty selection to make -- renders last.
      const textboxes = within(dialog).getAllByRole("textbox");
      const editable = textboxes[textboxes.length - 1];
      await userEvent.setup().click(editable);
      selectFirstCharacters(editable, 3);

      const assistButton = within(dialog).getByRole("button", {
        name: "AI Assistance for Content",
      });

      // The editor's own Lexical selection syncs from the native DOM
      // selection asynchronously (see form-field.test.tsx's identical
      // retry) -- retry the click until the dialog reflects a captured
      // selection, cancelling in between so no stray dialog is left open.
      await vi.waitFor(() => {
        fireEvent.click(assistButton);
        const suggestDialog = screen.getByRole("dialog", {
          name: "AI Assistance",
        });
        if (!suggestDialog.textContent?.includes("text you selected")) {
          fireEvent.click(
            within(suggestDialog).getByRole("button", { name: "Cancel" }),
          );
          throw new Error("selection not yet synced");
        }
      });

      const suggestDialog = screen.getByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        fullMaterial: "محتوى",
      });
      expect(lastRequestBody().text).not.toBe("محتوى");
    });

    it("sends Module Title and Module Description for Translate with AI", async () => {
      mockFetch({ other: { data: { text: "Content" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Content with AI",
        }),
      );
      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        bookId: "book-1",
        field: "content",
        text: "محتوى",
        moduleTitle: "المقدمة",
        moduleDescription: "وصف",
      });
    });

    it("applies the AI Assistance result to the active Content language", async () => {
      mockFetch({ other: { data: { text: "محتوى محسّن" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "AI Assistance for Content",
        }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      expect(
        await within(dialog).findByText("محتوى محسّن"),
      ).toBeInTheDocument();
    });
  });

  describe("Additional Instructions (ANA-98)", () => {
    it("includes the trimmed Additional Instructions text in the AI Assistance request", async () => {
      mockFetch({ other: { data: { text: "Suggested title" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "AI Assistance for Title" }),
      );
      const suggestDialog = await screen.findByRole("dialog", {
        name: "AI Assistance",
      });
      fireEvent.change(
        within(suggestDialog).getByLabelText(
          "Additional instructions or context (optional)",
        ),
        { target: { value: "Keep it short" } },
      );
      fireEvent.click(
        within(suggestDialog).getByRole("button", { name: "Generate" }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(lastRequestBody()).toMatchObject({
        additionalInstructions: "Keep it short",
      });
    });

    it("never opens Additional Instructions for Translate with AI, and never sends additionalInstructions", async () => {
      mockFetch({ other: { data: { text: "Introduction" } } });
      renderModal();

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "Translate Title with AI",
        }),
      );

      await vi.waitFor(() => expect(mutationCalls().length).toBeGreaterThan(0));
      expect(
        screen.queryByRole("dialog", { name: "Translate with AI" }),
      ).not.toBeInTheDocument();
      expect(lastRequestBody()).not.toHaveProperty("additionalInstructions");
    });
  });

  describe("Dirty state and close guard (PR review)", () => {
    it("closes immediately, without confirmation, when nothing has changed", async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("blocks Cancel once a field has been edited, offering Discard changes / Keep editing", async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(
        await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Your changes have not been saved and will be lost."),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(within(dialog).getByLabelText("Title")).toHaveValue("عنوان جديد");

      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("blocks Cancel once Lessons have been reordered but not saved (PR review regression)", async () => {
      mockFetch({
        lessons: [
          buildLessonFixture({
            id: "lesson-1",
            title: { ar: "Introduction", en: "" },
          }),
          buildLessonFixture({
            id: "lesson-2",
            title: { ar: "Prayer basics", en: "" },
            position: 1,
          }),
        ],
      });
      const onClose = vi.fn();
      renderModal({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      await within(dialog).findByText("Introduction");
      stubItemRects(["lesson-1", "lesson-2"]);
      const grip = within(dialog)
        .getByTestId("list-item-lesson-2")
        .querySelector("[aria-hidden='true']") as HTMLElement;

      grip.focus();
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(grip, { code: "ArrowUp", key: "ArrowUp" });
      fireEvent.keyDown(grip, { code: "Space", key: " " });
      await within(dialog).findByTestId("list-item-lesson-2");

      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(
        await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("blocks every other way of dismissing the modal (X button/Escape/backdrop, funneled through Mantine's own onClose) the same way as Cancel", async () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const dialog = await screen.findByRole("dialog", { name: "Edit Module" });
      fireEvent.change(within(dialog).getByLabelText("Title"), {
        target: { value: "عنوان جديد" },
      });

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

      expect(
        await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
