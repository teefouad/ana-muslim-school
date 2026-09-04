import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

import { DashboardShell } from "./dashboard-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({}),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("DashboardShell", () => {
  it("shows Manage Users for the super admin", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("link", { name: /Manage Users/ }),
    ).toBeInTheDocument();
  });

  it("shows Manage Users for a non-super-admin with users.manage permission", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: true }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("link", { name: /Manage Users/ }),
    ).toBeInTheDocument();
  });

  it("hides Manage Users for a non-super-admin without users.manage permission", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.queryByRole("link", { name: /Manage Users/ }),
    ).not.toBeInTheDocument();
  });

  it("always shows the Dashboard group items regardless of permissions", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.getByRole("link", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile/ })).toBeInTheDocument();
  });
});
