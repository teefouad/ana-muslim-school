"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Alert, Loader, Paper, Stack, Text, Title } from "@mantine/core";

import { getClientAuth } from "@/lib/firebase/client";
import { ChangePasswordForm } from "./change-password-form";

function getProviderLabel(providerId: string | undefined): string {
  switch (providerId) {
    case "password":
      return "Email and password";
    case "google.com":
      return "Google";
    default:
      return "Unknown";
  }
}

export function ProfileView({ email }: { email: string }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getClientAuth(), (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
  }, []);

  const providerId = authUser?.providerData[0]?.providerId;
  const hasPasswordProvider = providerId === "password";

  return (
    <Stack gap="xl" maw={480}>
      <Paper withBorder shadow="sm" radius="md" p="lg">
        <Stack gap="xs">
          <Title order={4}>Account</Title>
          <Text size="sm">Email: {authUser?.email ?? email}</Text>
          <Text size="sm">
            Sign-in method:{" "}
            {authLoading ? "Loading..." : getProviderLabel(providerId)}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder shadow="sm" radius="md" p="lg">
        <Stack gap="md">
          <Title order={4}>Change password</Title>

          {authLoading ? (
            <Loader size="sm" />
          ) : !authUser ? (
            <Text size="sm" c="dimmed">
              We couldn&apos;t verify your account in this browser. Refresh the
              page and try again.
            </Text>
          ) : hasPasswordProvider ? (
            <ChangePasswordForm />
          ) : (
            <Alert color="blue" variant="light">
              Password management for this account is handled by your sign-in
              provider. There is nothing to change here.
            </Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
