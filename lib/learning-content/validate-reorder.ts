/**
 * Validates that `newOrder` is a permutation of the exact current set of
 * ids -- no duplicates, no unknown ids, no silent attach/detach. Shared by
 * `Book.modules` and `Module.lessons`, which both enforce this same
 * same-set-reorder rule (see ANA-62).
 */
export function isValidReorder(
  newOrder: string[],
  currentOrder: string[],
): boolean {
  if (newOrder.length !== currentOrder.length) {
    return false;
  }

  const currentSet = new Set(currentOrder);
  const seen = new Set<string>();

  for (const id of newOrder) {
    if (!currentSet.has(id) || seen.has(id)) {
      return false;
    }

    seen.add(id);
  }

  return true;
}
