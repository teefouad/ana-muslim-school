import { Center, Text } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await getSessionUser();

  // The layout (app/admin/layout.tsx) already redirects unauthenticated
  // requests to /login before this page renders.
  const message = isSuperAdminEmail(user?.email)
    ? "hello"
    : "Your account is pending approval.";

  return (
    <Center flex={1} p="xl">
      <Text>{message}</Text>
    </Center>
  );
}
