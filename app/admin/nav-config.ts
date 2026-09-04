import { Users } from "lucide-react";

import type { DashboardNavGroup } from "@/components/ui/dashboard-shell/dashboard-shell";

/**
 * All current destinations require super-admin access, so the layout hides
 * this entirely for authenticated-but-unapproved accounts rather than
 * filtering individual links -- see app/admin/layout.tsx.
 */
export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    label: "Administration",
    links: [
      { label: "Manage Users", href: "/admin/manage-users", icon: Users },
    ],
  },
];
