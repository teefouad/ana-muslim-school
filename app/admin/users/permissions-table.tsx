import {
  Badge,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from "@mantine/core";

import { getAccessStatus } from "@/lib/permissions/access-status";
import type { PermissionRecord } from "@/lib/permissions/types";

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString() : "—";
}

function formatBookPermissions(
  books: PermissionRecord["permissions"]["books"],
): string {
  const labels = [
    books.read && "Read",
    books.create && "Add",
    books.update && "Edit",
    books.delete && "Delete",
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : "—";
}

export function PermissionsTable({ records }: { records: PermissionRecord[] }) {
  if (records.length === 0) {
    return <Text c="dimmed">No permission records yet.</Text>;
  }

  return (
    <Table striped withTableBorder>
      <TableThead>
        <TableTr>
          <TableTh>Email</TableTh>
          <TableTh>Books</TableTh>
          <TableTh>Manage Users</TableTh>
          <TableTh>Expires</TableTh>
          <TableTh>Created</TableTh>
          <TableTh>Status</TableTh>
        </TableTr>
      </TableThead>
      <TableTbody>
        {records.map((record) => {
          const status = getAccessStatus(record.expiresAt);

          return (
            <TableTr key={record.id}>
              <TableTd>{record.email}</TableTd>
              <TableTd>
                {formatBookPermissions(record.permissions.books)}
              </TableTd>
              <TableTd>
                {record.permissions.users.manage ? "Yes" : "No"}
              </TableTd>
              <TableTd>{formatDate(record.expiresAt)}</TableTd>
              <TableTd>{formatDate(record.createdAt)}</TableTd>
              <TableTd>
                <Badge color={status === "Active" ? "green" : "red"}>
                  {status}
                </Badge>
              </TableTd>
            </TableTr>
          );
        })}
      </TableTbody>
    </Table>
  );
}
