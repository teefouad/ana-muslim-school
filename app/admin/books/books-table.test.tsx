import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRouterMock, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  return { useRouterMock: vi.fn(() => ({ push: pushMock })), pushMock };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import { BooksProvider } from "./books-store";
import { BooksTable } from "./books-table";
import type { MockBook } from "./mock-books";

function renderWithProvider(books: MockBook[]) {
  return render(
    <MantineProvider>
      <BooksProvider initialBooks={books}>
        <BooksTable />
      </BooksProvider>
    </MantineProvider>,
  );
}

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

describe("BooksTable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("shows a message when there are no books", () => {
    renderWithProvider([]);
    expect(screen.getByText("No books yet.")).toBeInTheDocument();
  });

  it("renders fixture records through the shared DataTable", () => {
    renderWithProvider([
      buildBook({
        id: "book-1",
        title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
      }),
      buildBook({
        id: "book-2",
        title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
      }),
    ]);

    expect(screen.getByText("الرحيق المختوم")).toBeInTheDocument();
    expect(screen.getByText("رياض الصالحين")).toBeInTheDocument();
  });

  it("shows compact badges for Locked and Published rather than switches", () => {
    renderWithProvider([buildBook({ locked: true, published: false })]);

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("Locked")).toBeInTheDocument();
    expect(within(row).getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("navigates to the correct mock book's edit route when Edit is clicked", () => {
    renderWithProvider([
      buildBook({ id: "book-1", title: { ar: "الرحيق المختوم", en: "" } }),
      buildBook({ id: "book-2", title: { ar: "رياض الصالحين", en: "" } }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Edit رياض الصالحين/ }));

    expect(pushMock).toHaveBeenCalledWith("/admin/books/book-2/edit");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes a book from local state on delete confirmation, with no network call", async () => {
    renderWithProvider([
      buildBook({ id: "book-1", title: { ar: "الرحيق المختوم", en: "" } }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: /Delete الرحيق المختوم/ }),
    );
    expect(await screen.findByText("Delete book")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("الرحيق المختوم")).not.toBeInTheDocument();
    expect(screen.getByText("No books yet.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("keeps the book when the delete confirmation is cancelled", async () => {
    renderWithProvider([
      buildBook({ id: "book-1", title: { ar: "الرحيق المختوم", en: "" } }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: /Delete الرحيق المختوم/ }),
    );
    expect(await screen.findByText("Delete book")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("الرحيق المختوم")).toBeInTheDocument();
  });
});
