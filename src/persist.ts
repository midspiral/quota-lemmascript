// Tiny localStorage helpers shared by the local seams (store, auth, catalog, identity).

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota/full or disabled storage — local sandbox, best-effort */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function uid(): string {
  return crypto.randomUUID()
}

export const pageKey = (id: string): string => `quota:page:${id}`
