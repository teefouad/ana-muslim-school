"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BookPermissionKey = "read" | "create" | "update" | "delete";

const BOOK_PERMISSION_FIELDS: { key: BookPermissionKey; label: string }[] = [
  { key: "read", label: "Books: Read" },
  { key: "create", label: "Books: Add" },
  { key: "update", label: "Books: Edit" },
  { key: "delete", label: "Books: Delete" },
];

const EMPTY_BOOK_PERMISSIONS: Record<BookPermissionKey, boolean> = {
  read: false,
  create: false,
  update: false,
  delete: false,
};

export function PermissionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [books, setBooks] = useState(EMPTY_BOOK_PERMISSIONS);
  const [manageUsers, setManageUsers] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          permissions: {
            books,
            users: { manage: manageUsers },
          },
          expiresAt: expiresAt || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      setEmail("");
      setBooks(EMPTY_BOOK_PERMISSIONS);
      setManageUsers(false);
      setExpiresAt("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper withBorder shadow="sm" radius="md" p="xl" maw={480}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Title order={3}>Grant access</Title>

          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            autoComplete="email"
            required
          />

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Books
            </Text>
            {BOOK_PERMISSION_FIELDS.map((field) => (
              <Checkbox
                key={field.key}
                label={field.label}
                checked={books[field.key]}
                onChange={(event) =>
                  setBooks((current) => ({
                    ...current,
                    [field.key]: event.currentTarget.checked,
                  }))
                }
              />
            ))}
          </Stack>

          <Checkbox
            label="Manage Users"
            checked={manageUsers}
            onChange={(event) => setManageUsers(event.currentTarget.checked)}
          />

          <TextInput
            label="Access expires at"
            description="Optional. Leave blank for no expiration."
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.currentTarget.value)}
          />

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Group justify="flex-end">
            <Button type="submit" loading={loading}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
