import { BookOpen, BookPlus, FlaskConical, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Resolved, server-computed access used to decide nav item visibility. */
export type NavAccess = {
  isSuperAdmin: boolean;
  canManageUsers: boolean;
};

type NavItem = {
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
      {
        label: "Users",
        href: "/admin/manage-users",
        icon: Users,
        isVisible: (access) => access.isSuperAdmin || access.canManageUsers,
      },
    ],
  },
  {
    label: "Books",
    items: [
      {
        label: "All Books",
        href: "/admin/books",
        icon: BookOpen,
      },
      {
        label: "New Book",
        href: "/admin/books/new",
        icon: BookPlus,
      },
    ],
  },
  {
    label: "API",
    items: [
      {
        label: "Playground",
        href: "/admin/api-playground",
        icon: FlaskConical,
      },
    ],
  },
];
