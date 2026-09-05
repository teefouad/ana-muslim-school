import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { BooksProvider } from "../../books-store";
import { BooksTable } from "../../books-table";
import type { MockBook } from "../../mock-books";
import EditBookPage from "./page";

function buildBook(overrides: Partial<MockBook> = {}): MockBook {
  return {
    id: "book-1",
    title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
    description: { ar: "", en: "" },
    imageId: "sealed-nectar",
    locked: false,
    published: true,
    color: "#1c7ed6",
    ...overrides,
  };
}

// Renders the real EditBookPage alongside BooksTable, sharing one
// BooksProvider -- see new/page.test.tsx for why.
function renderHarness(books: MockBook[]) {
  return render(
    <MantineProvider>
      <BooksProvider initialBooks={books}>
        <EditBookPage />
        <BooksTable />
      </BooksProvider>
    </MantineProvider>,
  );
}

describe("EditBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    useParamsMock.mockReturnValue({ id: "book-1" });
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("prefills the form with the selected mock book's values, using the same Book form as Add Book", () => {
    renderHarness([buildBook()]);

    expect(screen.getByDisplayValue("الرحيق المختوم")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toHaveValue(
      "sealed-nectar",
    );
    expect(screen.getByRole("switch", { name: "Published" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("updates local state, navigates back, and makes no network call on save", () => {
    renderHarness([buildBook()]);

    fireEvent.change(screen.getByLabelText("In-app image ID"), {
      target: { value: "updated-image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("updated-image")).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith("/admin/books");
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("shows a not-found message for an id that doesn't match any mock book", () => {
    useParamsMock.mockReturnValue({ id: "missing" });
    renderHarness([buildBook()]);

    expect(
      screen.getByText("This mock book no longer exists in this demo session."),
    ).toBeInTheDocument();
  });
});
