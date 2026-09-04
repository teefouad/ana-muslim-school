export type BookPermissions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type PermissionSet = {
  books: BookPermissions;
  users: {
    manage: boolean;
  };
};

export type PermissionInput = {
  email: string;
  permissions: PermissionSet;
  expiresAt: Date | null;
};

export type PermissionRecord = {
  id: string;
  email: string;
  permissions: PermissionSet;
  expiresAt: Date | null;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
  lastLoginAt: Date | null;
};
