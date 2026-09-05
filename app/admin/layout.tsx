import { redirect } from "next/navigation";
import { Center, Stack, Text } from "@mantine/core";

import { getDashboardAccess } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { recordPermissionLogin } from "@/lib/permissions/permissions-service";
import { DashboardShell } from "./_components/dashboard-shell";
import { SignOutButton } from "./sign-out-button";

/**
 * Gatekeeper for every /admin route: resolves the caller's dashboard access
 * (see lib/auth/access.ts) and only renders `children` -- and therefore only
 * runs the requested page's own server-side data fetching -- once access is
 * confirmed. Pending/expired users get a standalone message instead, never
 * the dashboard shell or its nested routes (see ANA-50).
 */
export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const access = await getDashboardAccess();

  if (!access || access.status === "pending" || access.status === "expired") {
    const message =
      access?.status === "expired"
        ? "Your access has expired."
        : "Your account is pending approval.";

    return (
      <Center flex={1} p="xl">
        <Stack align="center" gap="md">
          <Text>{message}</Text>
          <SignOutButton />
        </Stack>
      </Center>
    );
  }

  if (access.status === "active") {
    try {
      await recordPermissionLogin(access.permission.id);
    } catch {
      // A failed lastLoginAt write must not block dashboard admission.
    }
  }

  const isSuperAdmin = access.status === "super-admin";
  const navAccess = {
    isSuperAdmin,
    canManageUsers:
      isSuperAdmin ||
      (access.status === "active" &&
        access.permission.permissions.users.manage),
  };

  return (
    <DashboardShell userEmail={user.email} navAccess={navAccess}>
      {props.children}
    </DashboardShell>
  );
}
