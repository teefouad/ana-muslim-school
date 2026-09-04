"use client";

import { useActionState, useEffect, useRef } from "react";
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

import { savePermission, type SavePermissionState } from "./actions";

const initialState: SavePermissionState = { status: "idle", message: null };

export function PermissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    savePermission,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Paper withBorder radius="md" p="lg">
      <form ref={formRef} action={formAction}>
        <Stack gap="md">
          <Title order={4}>Grant access</Title>

          <TextInput
            name="email"
            label="Email address"
            type="email"
            placeholder="person@example.com"
            required
            disabled={pending}
          />

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Books
            </Text>
            <Group gap="lg">
              <Checkbox name="booksRead" label="Read" disabled={pending} />
              <Checkbox name="booksCreate" label="Add" disabled={pending} />
              <Checkbox name="booksUpdate" label="Edit" disabled={pending} />
              <Checkbox name="booksDelete" label="Delete" disabled={pending} />
            </Group>
          </Stack>

          <Checkbox
            name="manageUsers"
            label="Manage Users"
            disabled={pending}
          />

          <TextInput
            name="expiresAt"
            label="Access expires at"
            description="Optional -- leave blank for no expiration"
            type="datetime-local"
            disabled={pending}
          />

          {state.status === "error" && (
            <Text c="red" size="sm">
              {state.message}
            </Text>
          )}
          {state.status === "success" && (
            <Text c="green" size="sm">
              {state.message}
            </Text>
          )}

          <Group justify="flex-end">
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
