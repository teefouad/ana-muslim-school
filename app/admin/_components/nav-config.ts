import { LayoutDashboard, UserCircle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Resolved, server-computed access used to decide nav item visibility. */
export type NavAccess = {
  isSuperAdmin: boolean;
  canManageUsers: boolean;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item is hidden from the sidebar unless this returns true for the signed-in user's resolved access. */
  isVisible?: (access: NavAccess) => boolean;
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
        isVisible: (access) => access.isSuperAdmin || access.canManageUsers,
      },
    ],
  },
];
