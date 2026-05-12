/**
 * Generic utility helpers — object, array, string and async operations
 */

export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result as Omit<T, K>;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {} as Pick<T, K>);
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function uniqueId(prefix = ""): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const groupKey = String(item[key]);
    acc[groupKey] = [...(acc[groupKey] ?? []), item];
    return acc;
  }, {});
}

export function sortBy<T>(arr: T[], key: keyof T, order: "asc" | "desc" = "asc"): T[] {
  return [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: TArgs): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
