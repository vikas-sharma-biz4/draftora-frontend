/**
 * Sort items by `createdAt` descending (newest first).
 * Generic so it works with any object that has a `createdAt` string field.
 */
export function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Sort items by `updatedAt` descending (most recently modified first).
 * Generic so it works with any object that has an `updatedAt` string field.
 */
export function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
