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
