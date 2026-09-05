"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { UserCircle } from "lucide-react";

import { SignOutButton } from "../sign-out-button";
import { NAV_GROUPS, type NavAccess } from "./nav-config";

type DashboardShellProps = {
  children: ReactNode;
  userEmail: string;
  navAccess: NavAccess;
};

export function DashboardShell({
  children,
  userEmail,
  navAccess,
}: DashboardShellProps) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const pathname = usePathname();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.isVisible || item.isVisible(navAccess),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <AppShell
      id="dashboard-shell"
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header withBorder={false}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={4}>Ana Muslim School</Title>
          </Group>
          <Group gap="sm">
            <UnstyledButton
              component={Link}
              href="/admin/profile"
              className="flex items-center gap-2 rounded-[var(--mantine-radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--mantine-color-default-hover)] focus-visible:bg-[var(--mantine-color-default-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mantine-primary-color-filled)]"
            >
              <UserCircle size={18} />
              <Text size="sm" c="dimmed">
                {userEmail}
              </Text>
            </UnstyledButton>
            <SignOutButton />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" withBorder={false}>
        {visibleGroups.map((group) => (
          <NavLink
            key={group.label}
            label={group.label}
            defaultOpened
            childrenOffset={0}
          >
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  leftSection={<Icon size={16} />}
                  active={pathname === item.href}
                />
              );
            })}
          </NavLink>
        ))}
      </AppShell.Navbar>

      <AppShell.Main
        className="flex flex-col"
        style={{
          marginTop: -20,
        }}
      >
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
