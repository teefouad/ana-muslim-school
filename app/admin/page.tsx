import { redirect } from "next/navigation";
import { Center, Text } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const message = isSuperAdminEmail(user.email)
    ? "hello"
    : "Your account is pending approval.";

  return (
    <Center flex={1} p="xl">
      <Text>{message}</Text>
    </Center>
  );
}
