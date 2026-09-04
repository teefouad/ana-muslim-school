import { redirect } from "next/navigation";
import { Stack, Title } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { listPermissions } from "@/lib/permissions/permissions-repository";
import { PermissionForm } from "./permission-form";
import { PermissionsTable } from "./permissions-table";

export default async function ManageUsersPage() {
  const user = await getSessionUser();

  if (!isSuperAdminEmail(user?.email)) {
    redirect("/admin");
  }

  const records = await listPermissions();

  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>Manage Users</Title>
      <PermissionForm />
      <PermissionsTable records={records} />
    </Stack>
  );
}
