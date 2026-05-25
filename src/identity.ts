// A local "who's who" directory: email → name, so the provider can show booker
// names. Bookers are now signed-in accounts, so their identity is their session;
// the verified core still only stores the (now-email) key, and names live here in
// the shell. Cloudflare keeps this server-side, readable only by the provider.
import { load, save } from "./persist"

const PEOPLE = "quota:people"
const HANDLES = "quota:handles" // handle -> owner email (the username registry)
const HANDLE_OF = "quota:handle-of" // email -> the handle it claimed

type People = Record<string, string> // email -> name
type Map = Record<string, string>

function baseHandle(email: string): string {
  const local = email.split("@")[0] ?? "user"
  return local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user"
}

// Claim a globally-unique public handle for this account, deriving it from the
// email but disambiguating collisions (sam, sam-2, …). Stable per email. This is
// the local stand-in for the Cloudflare D1 registry's UNIQUE(username) constraint.
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

export function rememberPerson(email: string, name: string): void {
  const people = load<People>(PEOPLE, {})
  if (people[email] !== name) {
    people[email] = name
    save(PEOPLE, people)
  }
}

export function nameFor(email: string): string {
  const people = load<People>(PEOPLE, {})
  return people[email] ?? email
}
