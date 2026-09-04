"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, isSuperAdminEmail } from "@/lib/auth/session";
import { isValidEmail, normalizeEmail } from "@/lib/permissions/email";
import { savePermissionRecord } from "@/lib/permissions/permissions";

export type SavePermissionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function parseExpiresAt(
  raw: FormDataEntryValue | null,
): Date | null | "invalid" {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

/**
 * Server Action backing the Manage Users form. Server Actions are reachable
 * via direct POST requests, not just through the page's UI, so authorization
 * is re-checked here rather than relying on the page-level guard alone --
 * see app/admin/manage-users/page.tsx.
 */
export async function savePermission(
  _prevState: SavePermissionState,
  formData: FormData,
): Promise<SavePermissionState> {
  const user = await getSessionUser();

  if (!user || !isSuperAdminEmail(user.email)) {
    return {
      status: "error",
      message: "You are not authorized to perform this action.",
    };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const expiresAt = parseExpiresAt(formData.get("expiresAt"));

  if (expiresAt === "invalid") {
    return { status: "error", message: "Enter a valid expiration date/time." };
  }

  await savePermissionRecord(
    {
      email,
      books: {
        read: formData.get("booksRead") === "on",
        create: formData.get("booksCreate") === "on",
        update: formData.get("booksUpdate") === "on",
        delete: formData.get("booksDelete") === "on",
      },
      manageUsers: formData.get("manageUsers") === "on",
      expiresAt,
    },
    user.email,
  );

  revalidatePath("/admin/manage-users");

  return { status: "success", message: `Permissions saved for ${email}.` };
}
