// Tiny hash router. Vanity-URL-shaped (#/:username/:pagename) so the structure
// carries straight over to Cloudflare path routing.
import { useEffect, useState } from "react"

export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "account" }
  | { name: "auth"; token: string; returnTo: string }
  | { name: "booking"; username: string; pagename: string }
  | { name: "manage"; username: string; pagename: string }
  | { name: "notfound" }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "")
  const [path, query] = raw.split("?")
  const parts = path.split("/").filter(Boolean)
  if (parts.length === 0) return { name: "home" }
  if (parts[0] === "new") return { name: "new" }
  if (parts[0] === "account") return { name: "account" }
  if (parts[0] === "auth") {
    const params = new URLSearchParams(query ?? "")
    return { name: "auth", token: params.get("token") ?? "", returnTo: params.get("returnTo") ?? "/" }
  }
  if (parts.length === 2) return { name: "booking", username: parts[0], pagename: parts[1] }
  if (parts.length === 3 && parts[2] === "manage") {
    return { name: "manage", username: parts[0], pagename: parts[1] }
  }
  return { name: "notfound" }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const onHash = (): void => setRoute(parseHash(location.hash))
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return route
}

export function navigate(to: string): void {
  location.hash = to
}

export function bookingHref(username: string, pagename: string): string {
  return `#/${username}/${pagename}`
}

export function manageHref(username: string, pagename: string): string {
  return `#/${username}/${pagename}/manage`
}
