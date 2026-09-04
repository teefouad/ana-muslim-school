"use client";

import { useState, type ReactNode } from "react";
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

// Group labels ("Dashboard", "Administration") are section toggles, not
// links -- they get a faint background at rest instead of Mantine's default
// solid hover fill, and fade to fully transparent on hover.
function NavGroupLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <NavLink
      label={label}
      defaultOpened
      childrenOffset={28}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 0,
        backgroundColor: hovered ? "transparent" : "rgba(255, 255, 255, 0.05)",
        transition: "background-color 150ms ease",
      }}
    >
      {children}
    </NavLink>
  );
}

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
          <NavGroupLabel key={group.label} label={group.label}>
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
                  style={{
                    padding: 0,
                    borderRadius: "var(--mantine-radius-sm)",
                    transition: "background-color 150ms ease, color 150ms ease",
                  }}
                />
              );
            })}
          </NavGroupLabel>
        ))}
      </AppShell.Navbar>

      <AppShell.Main className="flex flex-col">{children}</AppShell.Main>
    </AppShell>
  );
}
