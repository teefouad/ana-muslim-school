import { redirect } from "next/navigation";
import { Group, Stack, Title } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { listPermissions } from "@/lib/permissions/permissions-repository";
import { AddAccessModal } from "./add-access-modal";
import { PermissionsTable } from "./permissions-table";

export default async function ManageUsersPage() {
  const user = await getSessionUser();

  if (!isSuperAdminEmail(user?.email)) {
    redirect("/admin");
  }

  const records = await listPermissions();

  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between">
        <Title order={2}>Manage Users</Title>
        <AddAccessModal />
      </Group>
      <PermissionsTable records={records} />
    </Stack>
  );
}
