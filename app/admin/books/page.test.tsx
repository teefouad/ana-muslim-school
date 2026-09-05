import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { BooksProvider } from "./books-store";
import BooksPage from "./page";

function renderWithProviders() {
  return render(
    <MantineProvider>
      <BooksProvider>
        <BooksPage />
      </BooksProvider>
    </MantineProvider>,
  );
}

describe("BooksPage", () => {
  it("shows the Books title and an Add Book link", () => {
    renderWithProviders();

    expect(screen.getByRole("heading", { name: "Books" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Book" })).toHaveAttribute(
      "href",
      "/admin/books/new",
    );
  });

  it("renders the fixture books via the shared DataTable", () => {
    renderWithProviders();
    expect(screen.getByText("الرحيق المختوم")).toBeInTheDocument();
  });

  it("never uses Manage Books wording", () => {
    renderWithProviders();
    expect(screen.queryByText(/Manage Books/)).not.toBeInTheDocument();
  });
});
