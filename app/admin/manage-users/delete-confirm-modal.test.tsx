import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRouterMock, refreshMock } = vi.hoisted(() => {
  const refreshMock = vi.fn();
  return {
    useRouterMock: vi.fn(() => ({ refresh: refreshMock })),
    refreshMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

import type { PermissionRecord } from "@/lib/permissions/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function buildRecord(
  overrides: Partial<PermissionRecord> = {},
): PermissionRecord {
  return {
    id: "doc-1",
    email: "someone@example.com",
    permissions: {
      books: { read: true, create: false, update: false, delete: false },
      users: { manage: false },
    },
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin@example.com",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedBy: "admin@example.com",
    lastLoginAt: null,
    ...overrides,
  };
}

describe("DeleteConfirmModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ refresh: refreshMock });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("is closed when there is no record to delete", () => {
    renderWithProvider(<DeleteConfirmModal record={null} onClose={vi.fn()} />);

    expect(screen.queryByText("Delete access")).not.toBeInTheDocument();
  });

  it("shows a confirmation naming the record's email", async () => {
    renderWithProvider(
      <DeleteConfirmModal
        record={buildRecord({ email: "someone@example.com" })}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Delete access")).toBeInTheDocument();
    expect(screen.getByText("someone@example.com")).toBeInTheDocument();
  });

  it("calls onClose without making a request when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderWithProvider(
      <DeleteConfirmModal record={buildRecord()} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a DELETE to the record's own endpoint and calls onClose/refresh on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const onClose = vi.fn();

    renderWithProvider(
      <DeleteConfirmModal
        record={buildRecord({ id: "doc-42" })}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(
      "/api/permissions/doc-42",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the server's error message and does not call onClose on a failed delete", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Record not found." }), {
        status: 404,
      }),
    );
    const onClose = vi.fn();

    renderWithProvider(
      <DeleteConfirmModal record={buildRecord()} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Record not found.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
