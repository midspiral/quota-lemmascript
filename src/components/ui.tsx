// Small Tailwind atoms for a calm, airy light theme. One warm accent (amber).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "ghost" | "danger"

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
  const variants: Record<Variant, string> = {
    primary: "bg-amber-600 text-white hover:bg-amber-700",
    ghost: "border border-stone-300 text-stone-700 hover:bg-stone-100",
    danger: "border border-rose-200 text-rose-600 hover:bg-rose-50",
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint !== undefined && <span className="block text-xs text-stone-400">{hint}</span>}
    </label>
  )
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>{children}</div>
  )
}

// Capacity bar: the filled portion is how many seats are taken.
export function Bar({ taken, capacity }: { taken: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 100
  const full = capacity > 0 && taken >= capacity
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
      <div
        className={`h-full rounded-full transition-all ${full ? "bg-stone-400" : "bg-amber-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
