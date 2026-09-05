import { redirect } from "next/navigation";
import { Divider, Group, Stack, Title } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { listPermissions } from "@/lib/permissions/permissions-service";
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
        <Title order={2}>Users</Title>
        <AddAccessModal />
      </Group>
      <Divider opacity={0.25} mx={-27} />
      <PermissionsTable records={records} />
    </Stack>
  );
}
