import { Button } from "./ui"
import { navigate } from "../router"

export function NotFound({ message = "We couldn't find that page." }: { message?: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="text-stone-500">{message}</p>
      <div className="mt-6">
        <Button variant="ghost" onClick={() => navigate("/")}>
          Go home
        </Button>
      </div>
    </div>
  )
}
