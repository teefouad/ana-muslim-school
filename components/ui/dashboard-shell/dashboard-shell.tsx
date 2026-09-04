"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LucideIcon } from "lucide-react";

export type DashboardNavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type DashboardNavGroup = {
  label: string;
  links: DashboardNavLink[];
};

export type DashboardShellProps = {
  /** Grouped, labeled navigation links rendered in the sidebar. */
  navGroups: DashboardNavGroup[];
  /** Rendered on the right side of the header, e.g. a sign-out button. */
  actions?: ReactNode;
  children: ReactNode;
};

function isLinkActive(pathname: string | null, href: string): boolean {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

/**
 * Persistent dashboard shell: a header plus a left sidebar of collapsible,
 * labeled, icon-led navigation groups. Built on Mantine's `AppShell` and
 * `NavLink` rather than a bespoke nav system.
 */
export function DashboardShell({
  navGroups,
  actions,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileNavOpened, { toggle: toggleMobileNav }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !mobileNavOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileNavOpened}
              onClick={toggleMobileNav}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Title order={4}>Ana Muslim School Admin</Title>
          </Group>
          {actions}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <ScrollArea>
          <Stack gap={4}>
            {navGroups.length === 0 && (
              <Text c="dimmed" size="sm" p="sm">
                No navigation available.
              </Text>
            )}
            {navGroups.map((group) => (
              <NavLink
                key={group.label}
                label={group.label}
                defaultOpened
                childrenOffset={16}
              >
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.href}
                      component={Link}
                      href={link.href}
                      label={link.label}
                      leftSection={<Icon size={16} />}
                      active={isLinkActive(pathname, link.href)}
                    />
                  );
                })}
              </NavLink>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
