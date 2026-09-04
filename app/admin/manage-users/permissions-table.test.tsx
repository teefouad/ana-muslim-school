import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";

import type { PermissionRecord } from "@/lib/permissions/types";
import { PermissionsTable } from "./permissions-table";

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

describe("PermissionsTable", () => {
  it("renders a message when there are no records", () => {
    renderWithProvider(<PermissionsTable records={[]} />);
    expect(screen.getByText("No access records yet.")).toBeInTheDocument();
  });

  it("marks a record with no expiration as Active", () => {
    renderWithProvider(
      <PermissionsTable records={[buildRecord({ expiresAt: null })]} />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("marks a record with a future expiration as Active", () => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    renderWithProvider(
      <PermissionsTable records={[buildRecord({ expiresAt })]} />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("marks a record with a past expiration as Expired", () => {
    const expiresAt = new Date(Date.now() - 1000 * 60 * 60 * 24);
    renderWithProvider(
      <PermissionsTable records={[buildRecord({ expiresAt })]} />,
    );
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows 'Never' when the account has no recorded login", () => {
    renderWithProvider(
      <PermissionsTable
        records={[
          buildRecord({
            lastLoginAt: null,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          }),
        ]}
      />,
    );
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows the formatted last login date when present", () => {
    const lastLoginAt = new Date("2026-03-01T12:00:00.000Z");
    renderWithProvider(
      <PermissionsTable records={[buildRecord({ lastLoginAt })]} />,
    );
    expect(screen.getByText(lastLoginAt.toLocaleString())).toBeInTheDocument();
  });

  it("renders a placeholder rather than a locale-formatted string on the server-rendered pass, to avoid a hydration mismatch", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    const html = renderToString(
      <MantineProvider>
        <PermissionsTable records={[buildRecord({ createdAt })]} />
      </MantineProvider>,
    );

    expect(html).toContain("—");
    expect(html).not.toContain(createdAt.toLocaleString());
  });

  it("lists the granted book permissions", () => {
    renderWithProvider(
      <PermissionsTable
        records={[
          buildRecord({
            permissions: {
              books: {
                read: true,
                create: true,
                update: false,
                delete: false,
              },
              users: { manage: false },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Read, Add")).toBeInTheDocument();
  });
});
