"use client";

import { useState, useSyncExternalStore } from "react";
import { Badge, Modal } from "@mantine/core";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { PermissionRecord } from "@/lib/permissions/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { PermissionForm } from "./permission-form";

function subscribeNoop() {
  return () => {};
}

/**
 * True once the component has mounted in the browser. Client Components
 * are still rendered on the server for the initial HTML, so this needs to
 * be false there and only flip to true after hydration -- `useSyncExternalStore`
 * is the primitive React provides for a value that legitimately differs
 * between the server-rendered snapshot and the client snapshot (unlike a
 * plain `useState`/`useEffect` pair, it doesn't trigger an extra render).
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/**
 * Renders `date` formatted in the viewer's own browser locale/timezone.
 * Calling `toLocaleString()` unconditionally would use the *server's*
 * locale/timezone during the initial server-rendered pass and mismatch
 * what the browser renders on hydration, so a deterministic placeholder is
 * rendered until `useHasMounted` flips to true.
 */
function LocalDateTime({ date }: { date: Date | null }) {
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return "—";
  }

  return date ? date.toLocaleString() : "Never";
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

function getBookLabels(record: PermissionRecord): string {
  const { books } = record.permissions;
  const labels = [
    books.read && "Read",
    books.create && "Add",
    books.update && "Edit",
    books.delete && "Delete",
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : "None";
}

const columns: DataTableColumn<PermissionRecord>[] = [
  { key: "email", header: "Email", render: (record) => record.email },
  { key: "books", header: "Books", render: getBookLabels },
  {
    key: "manageUsers",
    header: "Manage Users",
    render: (record) => (record.permissions.users.manage ? "Yes" : "No"),
  },
  {
    key: "expires",
    header: "Expires",
    render: (record) => <LocalDateTime date={record.expiresAt} />,
  },
  {
    key: "created",
    header: "Created",
    render: (record) => <LocalDateTime date={record.createdAt} />,
  },
  {
    key: "lastLogin",
    header: "Last Login",
    render: (record) => <LocalDateTime date={record.lastLoginAt} />,
  },
  {
    key: "status",
    header: "Status",
    render: (record) => {
      const expired = isExpired(record.expiresAt);
      return (
        <Badge color={expired ? "red" : "green"} variant="light">
          {expired ? "Expired" : "Active"}
        </Badge>
      );
    },
  },
];

export function PermissionsTable({ records }: { records: PermissionRecord[] }) {
  const [editingRecord, setEditingRecord] = useState<PermissionRecord | null>(
    null,
  );
  const [deletingRecord, setDeletingRecord] = useState<PermissionRecord | null>(
    null,
  );

  return (
    <>
      <DataTable
        items={records}
        getItemId={(record) => record.id}
        columns={columns}
        emptyState="No access records yet."
        minWidth={800}
        onEditItem={setEditingRecord}
        getEditLabel={() => "Edit"}
        onDeleteItem={setDeletingRecord}
        getDeleteLabel={() => "Delete"}
      />

      <Modal
        opened={editingRecord !== null}
        onClose={() => setEditingRecord(null)}
        title="Edit access"
      >
        {editingRecord && (
          <PermissionForm
            record={editingRecord}
            onSuccess={() => setEditingRecord(null)}
            onCancel={() => setEditingRecord(null)}
          />
        )}
      </Modal>

      <DeleteConfirmModal
        record={deletingRecord}
        onClose={() => setDeletingRecord(null)}
      />
    </>
  );
}
