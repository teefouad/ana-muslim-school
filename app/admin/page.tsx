import { Center, Text } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";

export default async function AdminPage() {
  // The admin layout already redirects unauthenticated requests to /login,
  // so `user` is guaranteed here -- see app/admin/layout.tsx.
  const user = await getSessionUser();

  const message = isSuperAdminEmail(user?.email)
    ? "hello"
    : "Your account is pending approval.";

  return (
    <Center p="xl">
      <Text>{message}</Text>
    </Center>
  );
}
