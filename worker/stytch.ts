// Stytch email-magic-link integration (consumer API). Two plain `fetch` calls:
// send the link, and authenticate the returned token. Gated on credentials —
// when unset, the Worker falls back to its own keyless HMAC magic link (dev).
//
// Stytch handles email delivery, one-time-use, expiry, and rate limiting; we
// keep our own session (HMAC bearer) + D1 registry on top. Auth stays a trusted
// edge, entirely outside the verified core.
export interface StytchConfig {
  projectId?: string
  secret?: string
  apiUrl?: string // default: test env; use https://api.stytch.com/v1 for live
}

export const stytchEnabled = (c: StytchConfig): boolean =>
  c.projectId !== undefined && c.projectId !== "" && c.secret !== undefined && c.secret !== ""

const baseUrl = (c: StytchConfig): string => c.apiUrl ?? "https://test.stytch.com/v1"
const basicAuth = (c: StytchConfig): string => `Basic ${btoa(`${c.projectId}:${c.secret}`)}`

// Send a login-or-create magic link to `email`. Stytch appends its token to
// `redirectUrl`. Returns true on success.
export async function stytchSendMagicLink(c: StytchConfig, email: string, redirectUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl(c)}/magic_links/email/login_or_create`, {
      method: "POST",
      headers: { authorization: basicAuth(c), "content-type": "application/json" },
      body: JSON.stringify({
        email,
        login_magic_link_url: redirectUrl,
        signup_magic_link_url: redirectUrl,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Authenticate the token from the clicked link → the verified email (or null).
export async function stytchAuthenticate(c: StytchConfig, token: string): Promise<{ email: string } | null> {
  try {
    const res = await fetch(`${baseUrl(c)}/magic_links/authenticate`, {
      method: "POST",
      headers: { authorization: basicAuth(c), "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: { emails?: { email: string }[] } }
    const email = data.user?.emails?.[0]?.email
    return email !== undefined ? { email } : null
  } catch {
    return null
  }
}
