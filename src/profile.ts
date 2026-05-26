// Display name as a profile setting (set once after login, not at sign-in).
// Keyed to the signed-in account. Local: a localStorage map; remote: /api/account.
// Optional — providers fall back to showing the email when it's unset.
import { load, save } from "./persist"
import { apiGet, apiPost } from "./api"
import type { Session } from "./auth"

export interface Profile {
  name(): Promise<string>
  setName(name: string): Promise<void>
}

const NAMES = "quota:names" // email -> display name (local mode)
type Names = Record<string, string>

function currentEmail(): string | null {
  return load<Session | null>("quota:session", null)?.email ?? null
}

// Used by the local catalog to label bookers (provider view).
export function localNameFor(email: string): string {
  return load<Names>(NAMES, {})[email] ?? ""
}

export const localProfile: Profile = {
  async name() {
    const email = currentEmail()
    return email === null ? "" : localNameFor(email)
  },
  async setName(name) {
    const email = currentEmail()
    if (email === null) return
    const names = load<Names>(NAMES, {})
    names[email] = name.trim()
    save(NAMES, names)
  },
}

export const remoteProfile: Profile = {
  async name() {
    const r = await apiGet<{ name: string }>("/api/account")
    return r.data?.name ?? ""
  },
  async setName(name) {
    await apiPost("/api/account", { name: name.trim() })
  },
}
