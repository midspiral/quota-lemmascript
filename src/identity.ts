// Local handle registry: claims a globally-unique public username per account,
// derived from the email and disambiguated on collision (sam, sam-2, …). The
// local stand-in for the Cloudflare D1 `UNIQUE(handle)` constraint.
import { load, save } from "./persist"

const HANDLES = "quota:handles" // handle -> owner email
const HANDLE_OF = "quota:handle-of" // email -> the handle it claimed

type Map = Record<string, string>

function baseHandle(email: string): string {
  const local = email.split("@")[0] ?? "user"
  return local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user"
}

export function claimHandle(email: string): string {
  const ofEmail = load<Map>(HANDLE_OF, {})
  const already = ofEmail[email]
  if (already !== undefined) return already

  const owners = load<Map>(HANDLES, {})
  const base = baseHandle(email)
  let handle = base
  let n = 1
  while (owners[handle] !== undefined && owners[handle] !== email) {
    n += 1
    handle = `${base}-${n}`
  }
  owners[handle] = email
  ofEmail[email] = handle
  save(HANDLES, owners)
  save(HANDLE_OF, ofEmail)
  return handle
}
