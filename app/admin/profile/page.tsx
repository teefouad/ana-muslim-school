import { Stack, Title } from "@mantine/core";

import { getSessionUser } from "@/lib/auth/session";
import { ProfileView } from "./profile-view";

// The layout (app/admin/layout.tsx) already redirects unauthenticated
// requests to /login, and only renders this page once dashboard access is
// confirmed (see ANA-50) -- no further gating is needed here.
export default async function ProfilePage() {
  const user = await getSessionUser();

  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>Profile</Title>
      <ProfileView email={user?.email ?? ""} />
    </Stack>
  );
}
