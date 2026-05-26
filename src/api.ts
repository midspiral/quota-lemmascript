// Shared fetch helpers for the Cloudflare backend. The session bearer token is
// kept in localStorage and attached to every request. (Same-origin: the Worker
// serves both the SPA and /api/*.)
const TOKEN = "quota:token"

export const getToken = (): string | null => localStorage.getItem(TOKEN)
export const setToken = (t: string): void => localStorage.setItem(TOKEN, t)
export const clearToken = (): void => localStorage.removeItem(TOKEN)

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t === null ? {} : { authorization: `Bearer ${t}` }
}

export async function apiGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const r = await fetch(path, { headers: authHeaders() })
  return { status: r.status, data: (await r.json().catch(() => null)) as T | null }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<{ status: number; data: T | null }> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  })
  return { status: r.status, data: (await r.json().catch(() => null)) as T | null }
}
