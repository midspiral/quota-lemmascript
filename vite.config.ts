import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Local-first SPA. The Cloudflare backend (a Worker serving dist/ + /api/*) is a
// later increment gated on VITE_REMOTE; it requires no change to the app code.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
