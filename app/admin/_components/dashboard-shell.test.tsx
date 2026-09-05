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
  it("shows Users under the Dashboard group for the super admin", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Users$/ })).toBeInTheDocument();
  });

  it("shows Users for a non-super-admin with users.manage permission", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: true }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.getByRole("link", { name: /^Users$/ })).toBeInTheDocument();
  });

  it("hides Users for a non-super-admin without users.manage permission", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.queryByRole("link", { name: /^Users$/ }),
    ).not.toBeInTheDocument();
  });

  it("still shows the Dashboard group (via Books/Add Book) when Users is hidden", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Users$/ }),
    ).not.toBeInTheDocument();
  });

  it("shows Books and Add Book under the Dashboard group regardless of permissions", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/admin/books",
    );
    expect(screen.getByRole("link", { name: "Add Book" })).toHaveAttribute(
      "href",
      "/admin/books/new",
    );
  });

  it("never renders Manage Users or Manage Books wording", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.queryByText(/Manage Users/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage Books/)).not.toBeInTheDocument();
  });

  it("shows the API Playground link regardless of permissions", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="someone@example.com"
        navAccess={{ isSuperAdmin: false, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("link", { name: /Playground/ }),
    ).toBeInTheDocument();
  });

  it("no longer shows Overview or Profile as sidebar nav items", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.queryByRole("link", { name: /^Overview$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Profile$/ }),
    ).not.toBeInTheDocument();
  });

  it("no longer renders the Administration group", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("links the top-right user profile control to the Profile page", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("link", { name: /admin@example\.com/ }),
    ).toHaveAttribute("href", "/admin/profile");
  });

  it("gives the top-right user profile control a focus-visible affordance", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("link", { name: /admin@example\.com/ }),
    ).toHaveClass("focus-visible:outline");
  });

  it("keeps the sign-out control available", () => {
    renderWithProvider(
      <DashboardShell
        userEmail="admin@example.com"
        navAccess={{ isSuperAdmin: true, canManageUsers: false }}
      >
        <div />
      </DashboardShell>,
    );

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
