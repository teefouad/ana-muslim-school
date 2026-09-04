import {
  Badge,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from "@mantine/core";

import type { PermissionRecord } from "@/lib/permissions/types";

function formatDateTime(date: Date | null): string {
  return date ? date.toLocaleString() : "Never";
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

// Imports the `Table` subcomponents by their named exports rather than as
// `Table.Thead` etc. -- the compound-component properties resolve to
// `undefined` under Next's Turbopack dev bundler for this Mantine version.
export function PermissionsTable({ records }: { records: PermissionRecord[] }) {
  if (records.length === 0) {
    return <Text c="dimmed">No access records yet.</Text>;
  }

  return (
    <TableScrollContainer minWidth={800}>
      <Table striped highlightOnHover verticalSpacing="sm">
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
            const expired = isExpired(record.expiresAt);
            const { books } = record.permissions;
            const bookLabels = [
              books.read && "Read",
              books.create && "Add",
              books.update && "Edit",
              books.delete && "Delete",
            ].filter(Boolean);

            return (
              <TableTr key={record.id}>
                <TableTd>{record.email}</TableTd>
                <TableTd>
                  {bookLabels.length > 0 ? bookLabels.join(", ") : "None"}
                </TableTd>
                <TableTd>
                  {record.permissions.users.manage ? "Yes" : "No"}
                </TableTd>
                <TableTd>{formatDateTime(record.expiresAt)}</TableTd>
                <TableTd>{formatDateTime(record.createdAt)}</TableTd>
                <TableTd>
                  <Badge color={expired ? "red" : "green"} variant="light">
                    {expired ? "Expired" : "Active"}
                  </Badge>
                </TableTd>
              </TableTr>
            );
          })}
        </TableTbody>
      </Table>
    </TableScrollContainer>
  );
}
