export type BookPermissions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type PermissionsInput = {
  books: BookPermissions;
  users: {
    manage: boolean;
  };
};

export type PermissionRecord = {
  id: string;
  email: string;
  permissions: PermissionsInput;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  lastLoginAt: Date | null;
};

/**
 * Validates the shape of Firestore-sourced data before it's trusted for an
 * access decision -- a hand-edited or partially-written document must fail
 * closed rather than be coerced into a permissive default (see ANA-50).
 */
export function isValidPermissionsInput(
  value: unknown,
): value is PermissionsInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const books = (value as Record<string, unknown>).books;
  const users = (value as Record<string, unknown>).users;

  if (
    !books ||
    typeof books !== "object" ||
    !users ||
    typeof users !== "object"
  ) {
    return false;
  }

  const b = books as Record<string, unknown>;
  const u = users as Record<string, unknown>;

  return (
    typeof b.read === "boolean" &&
    typeof b.create === "boolean" &&
    typeof b.update === "boolean" &&
    typeof b.delete === "boolean" &&
    typeof u.manage === "boolean"
  );
}
