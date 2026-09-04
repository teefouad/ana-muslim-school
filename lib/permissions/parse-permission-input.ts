import { isValidEmail } from "./is-valid-email";
import { normalizeEmail } from "./normalize-email";
import type { PermissionInput } from "./types";

export type ParsePermissionInputResult =
  { ok: true; value: PermissionInput } | { ok: false; error: string };

function toBoolean(value: unknown): boolean {
  return value === true;
}

/**
 * Parses/validates the raw (client-supplied) shape for a permission record
 * into the domain `PermissionInput` type. Shared by the application layer
 * (route handler) so any future caller of the same operation -- including
 * future AI tools -- validates identically instead of duplicating this
 * logic.
 */
export function parsePermissionInput(
  input: unknown,
): ParsePermissionInputResult {
  const body = (input ?? {}) as Record<string, unknown>;
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = normalizeEmail(rawEmail);

  if (!email || !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt) {
    const parsed = new Date(body.expiresAt);

    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invalid expiration date." };
    }

    expiresAt = parsed;
  }

  const permissionsInput = (body.permissions ?? {}) as Record<string, unknown>;
  const booksInput = (permissionsInput.books ?? {}) as Record<string, unknown>;
  const usersInput = (permissionsInput.users ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    value: {
      email,
      permissions: {
        books: {
          read: toBoolean(booksInput.read),
          create: toBoolean(booksInput.create),
          update: toBoolean(booksInput.update),
          delete: toBoolean(booksInput.delete),
        },
        users: {
          manage: toBoolean(usersInput.manage),
        },
      },
      expiresAt,
    },
  };
}
