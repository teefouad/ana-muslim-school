import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
