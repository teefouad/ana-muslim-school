import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRouterMock, pushMock } = vi.hoisted(() => {
  const pushMock = vi.fn();
  return { useRouterMock: vi.fn(() => ({ push: pushMock })), pushMock };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import { BooksProvider } from "../books-store";
import { BooksTable } from "../books-table";
import AddBookPage from "./page";

// Renders the real AddBookPage alongside BooksTable, sharing one
// BooksProvider -- the same wiring app/admin/books/layout.tsx gives the real
// routes -- so a submitted book showing up in the table proves the page is
// actually driving the shared mock store, not just calling a stub.
function renderHarness() {
  return render(
    <MantineProvider>
      <BooksProvider initialBooks={[]}>
        <AddBookPage />
        <BooksTable />
      </BooksProvider>
    </MantineProvider>,
  );
}

describe("AddBookPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ push: pushMock });
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("has no Cancel button", () => {
    renderHarness();

    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("contains exactly the requested Book form fields", () => {
    renderHarness();

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app image ID")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Locked" })).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Published" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
  });

  it("renders Add book as a page header action that submits the Book form", () => {
    renderHarness();

    const addButton = screen.getByRole("button", { name: "Add book" });
    expect(addButton).toHaveAttribute("type", "submit");
    expect(addButton).toHaveAttribute("form");
  });

  it("renders Import Source disabled before the first save", () => {
    renderHarness();

    expect(
      screen.getByRole("button", { name: "Import Source" }),
    ).toBeDisabled();
  });

  it("renders the Sections panel disabled before the first save", () => {
    renderHarness();

    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
  });

  it("adds the submitted book to local state, stays on the same page, and makes no network call", () => {
    renderHarness();

    fireEvent.change(screen.getByLabelText("In-app image ID"), {
      target: { value: "new-book-image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByText("new-book-image")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("enables Import Source and the Sections panel after the Book is created in the current session", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    expect(screen.getByRole("button", { name: "Import Source" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add section" })).toBeEnabled();
  });

  it("switches the primary action to Save changes after the Book is created", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Add book" }));

    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add book" }),
    ).not.toBeInTheDocument();
  });
});
