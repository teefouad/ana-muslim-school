import { redirect } from "next/navigation";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { DashboardShell } from "@/components/ui/dashboard-shell/dashboard-shell";
import { dashboardNavGroups } from "./nav-config";
import { SignOutButton } from "./sign-out-button";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const navGroups = isSuperAdminEmail(user.email) ? dashboardNavGroups : [];

  return (
    <DashboardShell navGroups={navGroups} actions={<SignOutButton />}>
      {children}
    </DashboardShell>
  );
}
