"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  Button,
  Center,
  Divider,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { getClientAuth } from "@/lib/firebase/client";
import { getAuthErrorMessage } from "./auth-error";
import { GoogleIcon } from "./google-icon";

type Mode = "sign-in" | "sign-up";

async function establishSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Something went wrong. Please try again.");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const auth = getClientAuth();
      const credential =
        mode === "sign-in"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      await establishSession(await credential.user.getIdToken());
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithPopup(
        getClientAuth(),
        new GoogleAuthProvider(),
      );
      await establishSession(await credential.user.getIdToken());
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <Center flex={1} p="xl">
      <Paper withBorder shadow="sm" radius="md" p="xl" maw={400} w="100%">
        <Stack gap="md">
          <Title order={2} ta="center">
            User Login
          </Title>

          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            disabled={loading}
            data={[
              { label: "Sign in", value: "sign-in" },
              { label: "Sign up", value: "sign-up" },
            ]}
          />

          <form onSubmit={handleEmailSubmit}>
            <Stack gap="sm">
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                autoComplete="email"
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                required
              />

              {error && (
                <Text c="red" size="sm">
                  {error}
                </Text>
              )}

              <Button type="submit" loading={loading}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
            </Stack>
          </form>

          <Divider label="or" labelPosition="center" />

          <Button
            variant="default"
            leftSection={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            Continue with Google
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
