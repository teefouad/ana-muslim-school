"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { Button } from "@mantine/core";

import { getClientAuth } from "@/lib/firebase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    try {
      await signOut(getClientAuth());
      await fetch("/api/auth/session", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="default" onClick={handleSignOut} loading={loading}>
      Sign out
    </Button>
  );
}
