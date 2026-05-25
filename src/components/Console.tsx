import type { Session } from "../auth"
import { listPages } from "../catalog"
import { Button, Card } from "./ui"
import { navigate, manageHref, bookingHref } from "../router"

// Provider home (auth-gated): your pages + a way to create one.
export function Console({ session }: { session: Session }) {
  const pages = listPages(session.handle)

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Your pages</h1>
          <p className="mt-1 text-sm text-stone-500">
            at <span className="font-mono text-stone-600">quota.app/{session.handle}/…</span>
          </p>
        </div>
        <Button onClick={() => navigate("/new")}>New page</Button>
      </div>

      {pages.length === 0 ? (
        <Card className="mt-8 p-10 text-center">
          <p className="text-stone-500">No pages yet.</p>
          <div className="mt-4">
            <Button onClick={() => navigate("/new")}>Create your first page</Button>
          </div>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {pages.map((ref) => (
            <Card key={ref.pageId} className="flex items-center justify-between p-5">
              <div>
                <div className="text-lg text-stone-800">{ref.title}</div>
                <div className="font-mono text-xs text-stone-400">
                  {ref.username}/{ref.pagename}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate(bookingHref(ref.username, ref.pagename))}>
                  View
                </Button>
                <Button onClick={() => navigate(manageHref(ref.username, ref.pagename))}>Manage</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
