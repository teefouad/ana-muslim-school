import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { buildBookFixture } from "./book-fixtures";
import BooksPage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  return render(
    <MantineProvider>
      {/* A fresh SWR cache per render -- otherwise SWR's module-level cache
          would leak fixture data across test cases keyed by the same URL. */}
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <BooksPage />
      </SWRConfig>
    </MantineProvider>,
  );
}

describe("BooksPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: [] })),
    );
  });

  it("shows the Books title and a New Book link", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Books" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Book" })).toHaveAttribute(
      "href",
      "/admin/books/new",
    );
  });

  it("renders Books loaded from the API via the shared DataTable", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: [buildBookFixture({ title: { ar: "الرحيق المختوم", en: "" } })],
      }),
    );
    renderPage();

    expect(await screen.findByText("الرحيق المختوم")).toBeInTheDocument();
  });

  it("never uses Manage Books wording", () => {
    renderPage();
    expect(screen.queryByText(/Manage Books/)).not.toBeInTheDocument();
  });
});
