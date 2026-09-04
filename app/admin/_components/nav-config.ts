import { LayoutDashboard, UserCircle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from the sidebar for authenticated accounts that aren't the super admin. */
  superAdminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Profile", href: "/admin/profile", icon: UserCircle },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Manage Users",
        href: "/admin/manage-users",
        icon: Users,
        superAdminOnly: true,
      },
    ],
  },
];
