import { redirect } from "next/navigation";
import { Center, Stack, Text } from "@mantine/core";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { SignOutButton } from "./sign-out-button";

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
      <Stack align="center" gap="md">
        <Text>{message}</Text>
        <SignOutButton />
      </Stack>
    </Center>
  );
}
