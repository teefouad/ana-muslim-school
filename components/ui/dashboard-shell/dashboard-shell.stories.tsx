import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "@mantine/core";
import { BookOpen, Users } from "lucide-react";

import { DashboardShell, type DashboardNavGroup } from "./dashboard-shell";

const navGroups: DashboardNavGroup[] = [
  {
    label: "Administration",
    links: [
      { label: "Manage Users", href: "/admin/manage-users", icon: Users },
    ],
  },
  {
    label: "Library",
    links: [{ label: "Books", href: "/admin/books", icon: BookOpen }],
  },
];

const meta = {
  title: "UI/DashboardShell",
  component: DashboardShell,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/admin/manage-users" } },
  },
  args: {
    navGroups,
    children: <Text p="md">Page content goes here.</Text>,
  },
} satisfies Meta<typeof DashboardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoNavigation: Story = {
  args: {
    navGroups: [],
  },
};
