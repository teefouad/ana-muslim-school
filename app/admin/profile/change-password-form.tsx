"use client";

import { useState, type FormEvent } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Button, Group, PasswordInput, Stack, Text } from "@mantine/core";

import { getClientAuth } from "@/lib/firebase/client";
import { getAuthErrorMessage } from "@/app/login/auth-error";
import { establishSession } from "@/app/login/establish-session";

function getPasswordChangeErrorMessage(error: unknown): string {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  // Override a couple of codes with wording specific to this form -- the
  // shared helper's copy assumes a combined email+password login form.
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Your current password is incorrect.";
  }
  if (code === "auth/requires-recent-login") {
    return "For security, please sign out and sign back in, then try again.";
  }

  return getAuthErrorMessage(error);
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);

    try {
      // Always act on the live client session's own account -- never a
      // caller-supplied email/uid -- so this can only ever change the
      // currently authenticated user's own password.
      const currentUser = getClientAuth().currentUser;

      if (!currentUser?.email) {
        throw new Error("You must be signed in to change your password.");
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      // Firebase invalidates previously issued tokens (including the ones
      // backing our server-side session cookie) as soon as the password
      // changes. Refresh the cookie with a newly minted ID token so the
      // dashboard session the user is still looking at doesn't get treated
      // as revoked on the very next request.
      await establishSession(await currentUser.getIdToken(true));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(getPasswordChangeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          autoComplete="current-password"
          required
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.currentTarget.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          autoComplete="new-password"
          required
        />

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        {success && (
          <Text c="teal" size="sm">
            Password updated successfully.
          </Text>
        )}

        <Group justify="flex-end">
          <Button type="submit" loading={loading}>
            Update password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
