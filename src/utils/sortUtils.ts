/**
 * Sort items by `createdAt` descending (newest first).
 * Generic so it works with any object that has a `createdAt` string field.
 */
export function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
