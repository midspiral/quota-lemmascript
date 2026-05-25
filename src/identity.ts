// A local "who's who" directory: email → name, so the provider can show booker
// names. Bookers are now signed-in accounts, so their identity is their session;
// the verified core still only stores the (now-email) key, and names live here in
// the shell. Cloudflare keeps this server-side, readable only by the provider.
import { load, save } from "./persist"

const PEOPLE = "quota:people"

type People = Record<string, string> // email -> name

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
