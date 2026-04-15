"use client"
import { useState, FormEvent, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Logo from "@/components/Logo"

export default function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard")
    }
  }, [session, loading, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(username, password)
    if (signInError) {
      setError(signInError)
      setSubmitting(false)
    } else {
      router.replace("/dashboard")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0C0A08" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0C0A08" }}>
      <div className="w-full max-w-sm space-y-6">

        {/* Banner */}
        <div className="rounded-xl flex flex-col items-center text-center px-7 pt-9 pb-7"
          style={{ background: "#111111", border: "0.5px solid rgba(201,168,76,0.2)" }}>
          <Logo size={54} />
          <p className="mt-4 mb-1 text-xs font-semibold tracking-widest uppercase"
            style={{ color: "rgba(201,168,76,0.45)" }}>
            The Grand Mafia
          </p>
          <p className="mb-4 font-bold text-3xl tracking-wide"
            style={{ fontFamily: "Georgia, serif", color: "#E8C87A" }}>
            Consigliere
          </p>
          <div className="mb-4" style={{ width: 40, height: "0.5px", background: "rgba(201,168,76,0.25)" }} />
          <p className="mb-5 text-xs leading-relaxed" style={{ color: "#777570" }}>
            Ressourcen · Rankings · Battle Reports · FCU Events
          </p>
          <div className="w-full pt-4 flex flex-col items-center gap-1"
            style={{ borderTop: "0.5px solid rgba(201,168,76,0.12)" }}>
            <span className="text-xs font-medium tracking-widest uppercase"
              style={{ color: "rgba(201,168,76,0.4)" }}>
              powered by
            </span>
            <span className="font-bold tracking-wide"
              style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "rgba(201,168,76,0.75)" }}>
              Camorra Elite [1Ca]
            </span>
            <span className="text-xs italic"
              style={{ fontFamily: "Georgia, serif", color: "rgba(201,168,76,0.3)" }}>
              Eurer Vicar
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1"
              style={{ color: "rgba(201,168,76,0.6)" }}>
              Benutzername
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Dein Benutzername"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.2)", color: "#E8C87A" }}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1"
              style={{ color: "rgba(201,168,76,0.6)" }}>
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Dein Passwort"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.2)", color: "#E8C87A" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 font-medium rounded-lg transition-colors text-sm"
            style={{
              background: submitting ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.2)",
              border: "0.5px solid rgba(201,168,76,0.35)",
              color: submitting ? "rgba(201,168,76,0.4)" : "#E8C87A",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Anmelden..." : "Anmelden"}
          </button>
        </form>

        {/* Footer Links */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm" style={{ color: "rgba(201,168,76,0.3)" }}>
            {"Noch kein Konto? "}
            <Link href="/register" style={{ color: "rgba(201,168,76,0.6)" }}>
              Registrieren
            </Link>
          </p>
          <div style={{ width: "100%", height: "0.5px", background: "rgba(201,168,76,0.1)" }} />
          <Link
            href="/demo"
            className="w-full text-center text-sm py-2 px-4 rounded-lg transition-colors"
            style={{
              background: "rgba(201,168,76,0.07)",
              border: "0.5px solid rgba(201,168,76,0.2)",
              color: "rgba(201,168,76,0.7)",
            }}
          >
            {"🎬 App ohne Login erkunden"}
          </Link>
          {/* NEU: Passwort-vergessen-Hinweis */}
          <p className="text-center text-xs" style={{ color: "rgba(201,168,76,0.3)" }}>
            {"Passwort vergessen? Wende dich an einen R4."}
          </p>
        </div>

      </div>
    </div>
  )
}
