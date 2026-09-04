import { redirect } from "next/navigation";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      userEmail={user.email}
      isSuperAdmin={isSuperAdminEmail(user.email)}
    >
      {props.children}
    </DashboardShell>
  );
}
