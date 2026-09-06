/**
 * Converts a domain object's `createdAt`/`updatedAt` `Date` fields to
 * ISO-8601 strings for the HTTP response boundary. Repositories/services
 * work with `Date` internally (see lib/firestore/timestamps.ts); route
 * handlers own serialization and call this immediately before building the
 * `{ data }` envelope, so a raw Firestore Timestamp never reaches the
 * client.
 */
export function serializeAuditFields<
  T extends { createdAt: Date; updatedAt: Date },
>(
  entity: T,
): Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
} {
  return {
    ...entity,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
