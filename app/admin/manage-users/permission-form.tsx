"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Checkbox,
  Flex,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";

const initialPermissions = {
  booksRead: false,
  booksCreate: false,
  booksUpdate: false,
  booksDelete: false,
  usersManage: false,
};

type PermissionKey = keyof typeof initialPermissions;

export function PermissionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function togglePermission(key: PermissionKey) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          expiresAt,
          permissions: {
            books: {
              read: permissions.booksRead,
              create: permissions.booksCreate,
              update: permissions.booksUpdate,
              delete: permissions.booksDelete,
            },
            users: { manage: permissions.usersManage },
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      setEmail("");
      setExpiresAt(null);
      setPermissions(initialPermissions);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper withBorder shadow="sm" radius="md" p="xl">
      <form onSubmit={handleSubmit}>
        <Title order={4} mb="md">
          Grant or update access
        </Title>

        <Flex gap="md" align="stretch">
          <Stack gap="md" flex={1}>
            <Group grow align="flex-start">
              <TextInput
                label="Email address"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                autoComplete="email"
                required
              />

              <DateTimePicker
                label="Access expires"
                description="Leave blank for no expiration"
                clearable
                value={expiresAt}
                onChange={(value) => setExpiresAt(value)}
              />
            </Group>

            <Group gap="xl">
              <Group gap="sm">
                <Text size="sm" fw={500}>
                  Books
                </Text>
                <Checkbox
                  label="Read"
                  checked={permissions.booksRead}
                  onChange={() => togglePermission("booksRead")}
                />
                <Checkbox
                  label="Add"
                  checked={permissions.booksCreate}
                  onChange={() => togglePermission("booksCreate")}
                />
                <Checkbox
                  label="Edit"
                  checked={permissions.booksUpdate}
                  onChange={() => togglePermission("booksUpdate")}
                />
                <Checkbox
                  label="Delete"
                  checked={permissions.booksDelete}
                  onChange={() => togglePermission("booksDelete")}
                />
              </Group>

              <Checkbox
                label="Manage Users"
                checked={permissions.usersManage}
                onChange={() => togglePermission("usersManage")}
              />
            </Group>
          </Stack>

          <Button type="submit" loading={loading} h="auto" miw={140}>
            Save access
          </Button>
        </Flex>

        {error && (
          <Text c="red" size="sm" mt="md">
            {error}
          </Text>
        )}
      </form>
    </Paper>
  );
}
