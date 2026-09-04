"use client";

import { useSyncExternalStore } from "react";
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
            <TableTh>Last Login</TableTh>
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
                <TableTd>
                  <LocalDateTime date={record.expiresAt} />
                </TableTd>
                <TableTd>
                  <LocalDateTime date={record.createdAt} />
                </TableTd>
                <TableTd>
                  <LocalDateTime date={record.lastLoginAt} />
                </TableTd>
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
