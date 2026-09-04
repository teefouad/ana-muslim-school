import { Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// The only navigation destination this card introduces is Manage Users --
// see AGENTS.md: "Do not build placeholder pages for future navigation
// items just to fill the sidebar."
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Administration",
    items: [{ label: "Manage Users", href: "/admin/users", icon: Users }],
  },
];
