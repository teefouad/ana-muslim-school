"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, Burger, Group, NavLink, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { SignOutButton } from "../sign-out-button";
import { NAV_GROUPS } from "./nav-config";

type DashboardShellProps = {
  children: ReactNode;
  userEmail: string;
  isSuperAdmin: boolean;
};

export function DashboardShell({
  children,
  userEmail,
  isSuperAdmin,
}: DashboardShellProps) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const pathname = usePathname();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin),
  })).filter((group) => group.items.length > 0);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
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
            <Text size="sm" c="dimmed">
              {userEmail}
            </Text>
            <SignOutButton />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {visibleGroups.map((group) => (
          <NavLink
            key={group.label}
            label={group.label}
            defaultOpened
            childrenOffset={28}
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

      <AppShell.Main className="flex flex-col">{children}</AppShell.Main>
    </AppShell>
  );
}
