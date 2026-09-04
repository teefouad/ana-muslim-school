"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  AppShellNavbar,
  Burger,
  Group,
  NavLink,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { NAV_GROUPS } from "./nav-config";
import { SignOutButton } from "./sign-out-button";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileNavOpened, { toggle: toggleMobileNav }] = useDisclosure();
  const pathname = usePathname();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !mobileNavOpened },
      }}
      padding="md"
    >
      <AppShellHeader>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileNavOpened}
              onClick={toggleMobileNav}
              hiddenFrom="sm"
              size="sm"
            />
            <Text component={Link} href="/admin" fw={600}>
              Ana Muslim School
            </Text>
          </Group>
          <SignOutButton />
        </Group>
      </AppShellHeader>

      <AppShellNavbar p="md">
        {NAV_GROUPS.map((group) => (
          <NavLink key={group.label} label={group.label} defaultOpened fw={700}>
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  leftSection={<Icon size={18} />}
                  active={pathname === item.href}
                />
              );
            })}
          </NavLink>
        ))}
      </AppShellNavbar>

      <AppShellMain>{children}</AppShellMain>
    </AppShell>
  );
}
