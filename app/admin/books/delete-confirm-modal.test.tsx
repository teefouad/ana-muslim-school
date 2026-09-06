import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildBookFixture } from "./book-fixtures";
import { DeleteConfirmModal } from "./delete-confirm-modal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("DeleteConfirmModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("is closed when there is no book to delete", () => {
    renderWithProvider(
      <DeleteConfirmModal book={null} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByText("Delete book")).not.toBeInTheDocument();
  });

  it("shows a confirmation naming the book", async () => {
    renderWithProvider(
      <DeleteConfirmModal
        book={buildBookFixture()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(await screen.findByText("Delete book")).toBeInTheDocument();
    expect(
      screen.getByText("الرحيق المختوم", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("calls onClose without calling onConfirm or making a request when Cancel is clicked", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderWithProvider(
      <DeleteConfirmModal
        book={buildBookFixture()}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls DELETE /api/v1/books/{bookId} and onConfirm when Delete succeeds", async () => {
    const book = buildBookFixture({ id: "book-42" });
    const onConfirm = vi.fn();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true }),
    );

    renderWithProvider(
      <DeleteConfirmModal
        book={book}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(fetch).toHaveBeenCalledWith("/api/v1/books/book-42", {
      method: "DELETE",
    });
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("shows an error and does not call onConfirm when the delete request fails", async () => {
    const onConfirm = vi.fn();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Cannot delete this book." }, 409),
    );

    renderWithProvider(
      <DeleteConfirmModal
        book={buildBookFixture()}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Cannot delete this book."),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
