import { fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

const { useRouterMock, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  return { useRouterMock: vi.fn(() => ({ push: pushMock })), pushMock };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import { buildBookFixture } from "./book-fixtures";
import { BooksTable } from "./books-table";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchOnce(response: Response) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(response);
}

function renderTable() {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak fixture data across test cases keyed by the same URL. */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <BooksTable />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("BooksTable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads from GET /api/v1/books rather than mock application state", async () => {
    mockFetchOnce(jsonResponse({ data: [] }));
    renderTable();

    await screen.findByText("No books yet.");

    expect(fetch).toHaveBeenCalledWith("/api/v1/books");
  });

  it("shows a loading state before the request resolves", () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderTable();

    expect(screen.getByText("Loading books…")).toBeInTheDocument();
  });

  it("displays returned Book data", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [
          buildBookFixture({
            id: "book-1",
            title: { ar: "الرحيق المختوم", en: "The Sealed Nectar" },
          }),
          buildBookFixture({
            id: "book-2",
            title: { ar: "رياض الصالحين", en: "Riyad as-Salihin" },
          }),
        ],
      }),
    );
    renderTable();

    expect(await screen.findByText("الرحيق المختوم")).toBeInTheDocument();
    expect(screen.getByText("رياض الصالحين")).toBeInTheDocument();
  });

  it("shows a request-error state when the list request fails, without crashing", async () => {
    mockFetchOnce(jsonResponse({ error: "Books are unavailable." }, 500));
    renderTable();

    expect(
      await screen.findByText("Books are unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByText("No books yet.")).toBeInTheDocument();
  });

  it("shows compact badges for Locked and Published rather than switches", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [buildBookFixture({ isLocked: true, isPublished: false })],
      }),
    );
    renderTable();

    const row = await screen.findAllByRole("row");
    expect(within(row[1]).getByText("Locked")).toBeInTheDocument();
    expect(within(row[1]).getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("edits using the real Book id returned by the API", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [
          buildBookFixture({
            id: "real-book-id",
            title: { ar: "كتاب", en: "" },
          }),
        ],
      }),
    );
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Edit كتاب/ }));

    expect(pushMock).toHaveBeenCalledWith("/admin/books/real-book-id/edit");
  });

  it("calls DELETE /api/v1/books/{bookId} and removes the book from the visible list on success", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [
          buildBookFixture({ id: "book-1", title: { ar: "كتاب", en: "" } }),
        ],
      }),
    );
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Delete كتاب/ }));
    expect(await screen.findByText("Delete book")).toBeInTheDocument();

    mockFetchOnce(jsonResponse({ ok: true }));
    // The list revalidates (a fresh GET) after a successful delete.
    mockFetchOnce(jsonResponse({ data: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByText("No books yet.");
    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-1", {
      method: "DELETE",
    });
  });

  it("keeps the book and shows an error when the delete request fails", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [
          buildBookFixture({ id: "book-1", title: { ar: "كتاب", en: "" } }),
        ],
      }),
    );
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Delete كتاب/ }));
    expect(await screen.findByText("Delete book")).toBeInTheDocument();

    mockFetchOnce(jsonResponse({ error: "Cannot delete this book." }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Cannot delete this book."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("كتاب").length).toBeGreaterThan(0);
  });

  it("keeps the book when the delete confirmation is cancelled, with no request", async () => {
    mockFetchOnce(
      jsonResponse({
        data: [
          buildBookFixture({ id: "book-1", title: { ar: "كتاب", en: "" } }),
        ],
      }),
    );
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: /Delete كتاب/ }));
    expect(await screen.findByText("Delete book")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("كتاب")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves a named application-color token to its hex value for the color swatch, but shows the token text as-is", async () => {
    mockFetchOnce(
      jsonResponse({ data: [buildBookFixture({ color: "cyan.6" })] }),
    );
    renderTable();

    expect(await screen.findByText("cyan.6")).toBeInTheDocument();
    // The swatch is a decorative aria-hidden span with no accessible role.
    const swatch = document.querySelector('span[aria-hidden="true"]');
    expect(swatch).toHaveStyle({ backgroundColor: "#15aabf" });
  });
});
