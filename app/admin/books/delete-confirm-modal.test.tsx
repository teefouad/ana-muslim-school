import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteConfirmModal } from "./delete-confirm-modal";
import type { MockBook } from "./mock-books";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
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
        book={buildBook()}
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
        book={buildBook()}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls onConfirm without making a request when Delete is clicked", () => {
    const onConfirm = vi.fn();
    renderWithProvider(
      <DeleteConfirmModal
        book={buildBook()}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
