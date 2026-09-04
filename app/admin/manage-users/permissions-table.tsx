import { Badge, Table, Text } from "@mantine/core";

import type { PermissionRecord } from "@/lib/permissions/permissions";

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString() : "—";
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

function formatBookPermissions(
  books: PermissionRecord["permissions"]["books"],
): string {
  return (
    [
      books.read && "Read",
      books.create && "Add",
      books.update && "Edit",
      books.delete && "Delete",
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export function PermissionsTable({ records }: { records: PermissionRecord[] }) {
  if (records.length === 0) {
    return <Text c="dimmed">No permission records yet.</Text>;
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Email</Table.Th>
          <Table.Th>Books</Table.Th>
          <Table.Th>Manage Users</Table.Th>
          <Table.Th>Expires</Table.Th>
          <Table.Th>Created</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {records.map((record) => {
          const expired = isExpired(record.expiresAt);

          return (
            <Table.Tr key={record.id}>
              <Table.Td>{record.email}</Table.Td>
              <Table.Td>
                {formatBookPermissions(record.permissions.books)}
              </Table.Td>
              <Table.Td>
                {record.permissions.users.manage ? "Yes" : "No"}
              </Table.Td>
              <Table.Td>{formatDate(record.expiresAt)}</Table.Td>
              <Table.Td>{formatDate(record.createdAt)}</Table.Td>
              <Table.Td>
                <Badge color={expired ? "red" : "green"} variant="light">
                  {expired ? "Expired" : "Active"}
                </Badge>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
