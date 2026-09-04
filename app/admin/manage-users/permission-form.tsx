"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Checkbox,
  Fieldset,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";

import { toDateTimePickerValueOrNull, toIsoStringOrNull } from "@/lib/dates";
import type {
  PermissionRecord,
  PermissionsInput,
} from "@/lib/permissions/types";

const initialPermissions = {
  booksRead: false,
  booksCreate: false,
  booksUpdate: false,
  booksDelete: false,
  usersManage: false,
};

type PermissionKey = keyof typeof initialPermissions;

function toFormPermissions(
  permissions: PermissionsInput,
): typeof initialPermissions {
  return {
    booksRead: permissions.books.read,
    booksCreate: permissions.books.create,
    booksUpdate: permissions.books.update,
    booksDelete: permissions.books.delete,
    usersManage: permissions.users.manage,
  };
}

export function PermissionForm({
  record,
  onSuccess,
  onCancel,
}: {
  /** When given, the form edits this existing record instead of creating a new one. */
  record?: PermissionRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const isEditing = record !== undefined;
  const router = useRouter();
  const [email, setEmail] = useState(record?.email ?? "");
  const [expiresAt, setExpiresAt] = useState<string | null>(
    toDateTimePickerValueOrNull(record?.expiresAt ?? null),
  );
  const [permissions, setPermissions] = useState(
    record ? toFormPermissions(record.permissions) : initialPermissions,
  );
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
      const response = await fetch(
        isEditing ? `/api/permissions/${record.id}` : "/api/permissions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isEditing ? {} : { email }),
            // The picker's value has no timezone info -- convert it to an
            // ISO string (in the browser's own timezone) before sending, so
            // the server stores the instant the admin actually picked rather
            // than reinterpreting the same digits in the server's timezone.
            expiresAt: toIsoStringOrNull(expiresAt),
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
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ?? "Something went wrong. Please try again.",
        );
      }

      if (!isEditing) {
        setEmail("");
        setExpiresAt(null);
        setPermissions(initialPermissions);
      }
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <TextInput
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          readOnly={isEditing}
          autoComplete="email"
          required
        />

        <Fieldset legend="Books">
          <Group>
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
        </Fieldset>

        <Fieldset legend="Users">
          <Group>
            <Checkbox
              label="Manage Users"
              checked={permissions.usersManage}
              onChange={() => togglePermission("usersManage")}
            />
          </Group>
        </Fieldset>

        <DateTimePicker
          label="Access expires"
          description="Leave blank for no expiration"
          clearable
          value={expiresAt}
          onChange={(value) => setExpiresAt(value)}
        />

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        <Group justify="flex-end">
          {isEditing && (
            <Button variant="default" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={loading}>
            {isEditing ? "Save changes" : "Save access"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
