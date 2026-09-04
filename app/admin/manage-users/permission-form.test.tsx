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
import { PermissionForm } from "./permission-form";

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

describe("PermissionForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRouterMock.mockReturnValue({ refresh: refreshMock });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("prefills the email (read-only) and permissions from the given record", () => {
    renderWithProvider(
      <PermissionForm
        record={buildRecord({
          email: "existing@example.com",
          permissions: {
            books: { read: true, create: true, update: false, delete: false },
            users: { manage: true },
          },
        })}
      />,
    );

    const emailInput = screen.getByLabelText(/Email address/);
    expect(emailInput).toHaveValue("existing@example.com");
    expect(emailInput).toHaveAttribute("readonly");

    expect(screen.getByLabelText("Read")).toBeChecked();
    expect(screen.getByLabelText("Add")).toBeChecked();
    expect(screen.getByLabelText("Edit")).not.toBeChecked();
    expect(screen.getByLabelText("Delete")).not.toBeChecked();
    expect(screen.getByLabelText("Manage Users")).toBeChecked();

    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render an email input as read-only, and has no Cancel button, when creating a new record", () => {
    renderWithProvider(<PermissionForm />);

    expect(screen.getByLabelText(/Email address/)).not.toHaveAttribute(
      "readonly",
    );
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save access" }),
    ).toBeInTheDocument();
  });

  it("calls onCancel without making a request when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderWithProvider(
      <PermissionForm record={buildRecord()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a PATCH to the record's own endpoint, without an email field, and calls onSuccess", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const onSuccess = vi.fn();

    renderWithProvider(
      <PermissionForm
        record={buildRecord({ id: "doc-42" })}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(
      "/api/permissions/doc-42",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).not.toHaveProperty("email");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the server's error message on a failed save", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Record not found." }), {
        status: 404,
      }),
    );

    renderWithProvider(<PermissionForm record={buildRecord()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Record not found.")).toBeInTheDocument();
  });
});
