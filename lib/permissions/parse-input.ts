import dayjs from "dayjs";

import type { PermissionsInput } from "./types";

/**
 * Coerces a request body's `permissions` value into boolean flags. Any
 * truthy-but-non-boolean value (e.g. the string `"false"`) is treated as
 * `false` -- a spoofed or malformed body must not grant a permission it
 * didn't explicitly set to `true`.
 */
export function toBooleanFlags(value: unknown): PermissionsInput {
  const books =
    value && typeof value === "object" && "books" in value
      ? (value as { books?: unknown }).books
      : undefined;
  const users =
    value && typeof value === "object" && "users" in value
      ? (value as { users?: unknown }).users
      : undefined;
  const booksObj = (books ?? {}) as Record<string, unknown>;
  const usersObj = (users ?? {}) as Record<string, unknown>;

  return {
    books: {
      read: booksObj.read === true,
      create: booksObj.create === true,
      update: booksObj.update === true,
      delete: booksObj.delete === true,
    },
    users: {
      manage: usersObj.manage === true,
    },
  };
}

export type ParsedExpiresAt = { ok: true; value: Date | null } | { ok: false };

/**
 * Parses a request body's `expiresAt` value. A missing/empty value means "no
 * expiration"; a present-but-unparsable value is rejected rather than
 * silently treated as no expiration.
 *
 * The client converts the DateTimePicker's timezone-less value to an ISO
 * string (with an explicit UTC offset) before sending it, so the instant is
 * preserved regardless of which timezone the server runs in -- see
 * app/admin/manage-users/permission-form.tsx. dayjs parses that reliably
 * across JS engines, unlike the native `Date` constructor.
 */
export function parseExpiresAt(value: unknown): ParsedExpiresAt {
  if (typeof value !== "string" || !value) {
    return { ok: true, value: null };
  }

  const parsed = dayjs(value);

  if (!parsed.isValid()) {
    return { ok: false };
  }

  return { ok: true, value: parsed.toDate() };
}
