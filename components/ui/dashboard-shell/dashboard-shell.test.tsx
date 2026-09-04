import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { Users } from "lucide-react";

import { DashboardShell, type DashboardNavGroup } from "./dashboard-shell";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(() => "/admin"),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

const navGroups: DashboardNavGroup[] = [
  {
    label: "Administration",
    links: [
      { label: "Manage Users", href: "/admin/manage-users", icon: Users },
    ],
  },
];

function renderShell(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);

  return render(
    <MantineProvider>
      <DashboardShell navGroups={navGroups} actions={<button>Sign out</button>}>
        <div>Page content</div>
      </DashboardShell>
    </MantineProvider>,
  );
}

describe("DashboardShell", () => {
  it("renders grouped navigation links and the page content", () => {
    renderShell("/admin");

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage users/i })).toHaveAttribute(
      "href",
      "/admin/manage-users",
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("marks the link matching the current path as active", () => {
    renderShell("/admin/manage-users");

    expect(screen.getByRole("link", { name: /manage users/i })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("does not mark the link active on a different path", () => {
    renderShell("/admin");

    expect(
      screen.getByRole("link", { name: /manage users/i }),
    ).not.toHaveAttribute("data-active");
  });

  it("does not crash and marks nothing active when the pathname is unavailable", () => {
    renderShell(null as unknown as string);

    expect(
      screen.getByRole("link", { name: /manage users/i }),
    ).not.toHaveAttribute("data-active");
  });

  it("renders a placeholder when there are no nav groups", () => {
    usePathnameMock.mockReturnValue("/admin");

    render(
      <MantineProvider>
        <DashboardShell navGroups={[]}>
          <div>Page content</div>
        </DashboardShell>
      </MantineProvider>,
    );

    expect(screen.getByText("No navigation available.")).toBeInTheDocument();
  });
});
