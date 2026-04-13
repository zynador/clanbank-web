"use client"
import { useState, FormEvent, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import Logo from "@/components/Logo"

type Step = "code" | "details" | "claim" | "success"

interface StarterMember {
  id: string
  ingame_name: string
  display_name: string | null
}

export default function RegisterPage() {
  const { signUp, session, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>("code")
  const [inviteCode, setInviteCode] = useState("")
  const [clanName, setClanName] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [ingameName, setIngameName] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [starterMembers, setStarterMembers] = useState<StarterMember[]>([])
  const [selectedStarterId, setSelectedStarterId] = useState<string>("")
  const [claimDone, setClaimDone] = useState(false)

  useEffect(() => {
    if (!loading && session && step === "code") {
      router.replace("/dashboard")
    }
  }, [session, loading, router, step])

  async function handleValidateCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { data, error: rpcError } = await supabase.rpc("validate_clan_code", {
      input_code: inviteCode.trim().toUpperCase(),
    })
    setSubmitting(false)
    if (rpcError) { setError("Fehler bei der Code-Prüfung: " + rpcError.message); return }
    if (!data || !data.valid) { setError(data?.error || "Ungültiger oder bereits verwendeter Code."); return }
    setClanName(data.clan_name)
    setStep("details")
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirm) { setError("Passwörter stimmen nicht überein."); return }
    if (password.length < 6) { setError("Passwort muss mindestens 6 Zeichen lang sein."); return }
    if (username.length < 3) { setError("Benutzername muss mindestens 3 Zeichen lang sein."); return }
    setSubmitting(true)
    const { error: signUpError } = await signUp({
      username,
      password,
      displayName: displayName || username,
      ingameName: ingameName || username,
      inviteCode: inviteCode.trim().toUpperCase(),
    })
    setSubmitting(false)
    if (signUpError) { setError(signUpError); return }
    const { data: starters } = await supabase
      .from("starter_members")
      .select("id, ingame_name, display_name")
      .eq("status", "unclaimed")
      .order("ingame_name")
    setStarterMembers((starters as StarterMember[]) || [])
    setStep("claim")
  }

  async function handleClaim() {
    if (!selectedStarterId) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc("claim_starter_profile", {
      starter_id: selectedStarterId,
    })
    setSubmitting(false)
    if (rpcError || !(data as { success: boolean })?.success) {
      setError(rpcError?.message || (data as { message: string })?.message || "Fehler beim Einreichen.")
      return
    }
    setClaimDone(true)
    setStep("success")
  }

  useEffect(() => {
    if (step === "success") {
      const t = setTimeout(() => router.replace("/dashboard"), 2500)
      return () => clearTimeout(t)
    }
  }, [step, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0C0A08" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0C0A08" }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex justify-center">
          <Logo size={48} />
        </div>

        {/* Step 1: Code */}
        {step === "code" && (
          <form onSubmit={handleValidateCode} className="space-y-4">
            <h2 className="text-lg font-semibold text-center" style={{ color: "#E8C87A", fontFamily: "Georgia, serif" }}>Registrierung</h2>
            <p className="text-sm text-center" style={{ color: "rgba(201,168,76,0.4)" }}>
              Gib deinen Einladungscode ein, um fortzufahren.
            </p>
            {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">{error}</div>}
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium mb-1" style={{ color: "rgba(201,168,76,0.6)" }}>Einladungscode</label>
              <input
                id="inviteCode" type="text" value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required maxLength={10}
                className="w-full px-3 py-2 rounded-lg text-center tracking-widest text-lg focus:outline-none"
                style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.2)", color: "#E8C87A" }}
                placeholder="XXXXXX"
              />
            </div>
            <button type="submit" disabled={submitting || inviteCode.length < 4}
              className="w-full py-2 px-4 font-medium rounded-lg text-sm transition-colors"
              style={{ background: "rgba(201,168,76,0.2)", border: "0.5px solid rgba(201,168,76,0.35)", color: "#E8C87A", cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Prüfe..." : "Code prüfen"}
            </button>
            <p className="text-center text-sm" style={{ color: "rgba(201,168,76,0.3)" }}>
              Bereits registriert?{" "}
              <Link href="/login" style={{ color: "rgba(201,168,76,0.6)" }}>Anmelden</Link>
            </p>
          </form>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(201,168,76,0.07)", border: "0.5px solid rgba(201,168,76,0.2)" }}>
              <p className="text-sm" style={{ color: "rgba(201,168,76,0.7)" }}>Clan: <span className="font-semibold">{clanName}</span></p>
            </div>
            {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">{error}</div>}
            {(["username", "displayName", "ingameName", "password", "passwordConfirm"] as const).map((field) => (
              <div key={field}>
                <label htmlFor={field} className="block text-sm font-medium mb-1" style={{ color: "rgba(201,168,76,0.6)" }}>
                  {field === "username" ? "Benutzername *" : field === "displayName" ? "Anzeigename" : field === "ingameName" ? "Ingame-Name" : field === "password" ? "Passwort *" : "Passwort wiederholen *"}
                </label>
                <input
                  id={field}
                  type={field.toLowerCase().includes("password") ? "password" : "text"}
                  value={field === "username" ? username : field === "displayName" ? displayName : field === "ingameName" ? ingameName : field === "password" ? password : passwordConfirm}
                  onChange={(e) => { const v = e.target.value; if (field === "username") setUsername(v); else if (field === "displayName") setDisplayName(v); else if (field === "ingameName") setIngameName(v); else if (field === "password") setPassword(v); else setPasswordConfirm(v) }}
                  required={["username", "password", "passwordConfirm"].includes(field)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.2)", color: "#E8C87A" }}
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep("code"); setError(null) }}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.15)", color: "rgba(201,168,76,0.5)" }}>
                Zurück
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2 px-4 font-medium rounded-lg text-sm transition-colors"
                style={{ background: "rgba(201,168,76,0.2)", border: "0.5px solid rgba(201,168,76,0.35)", color: "#E8C87A", cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "Registriere..." : "Registrieren"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Starter-Claim */}
        {step === "claim" && (
          <div className="space-y-5">
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(201,168,76,0.07)", border: "0.5px solid rgba(201,168,76,0.2)" }}>
              <p className="text-sm" style={{ color: "rgba(201,168,76,0.7)" }}>Registrierung erfolgreich ✓</p>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold" style={{ color: "#E8C87A", fontFamily: "Georgia, serif" }}>Bist du bereits Clan-Mitglied?</h2>
              <p className="text-sm" style={{ color: "rgba(201,168,76,0.4)" }}>Wähle deinen Namen aus der Clan-Liste, falls du bereits eingetragen bist.</p>
            </div>
            {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">{error}</div>}
            {starterMembers.length > 0 ? (
              <div className="space-y-3">
                <select value={selectedStarterId} onChange={(e) => { setSelectedStarterId(e.target.value); setError(null) }}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.2)", color: "#E8C87A" }}>
                  <option value="">— Ich bin nicht in der Liste —</option>
                  {starterMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ingame_name + (m.display_name && m.display_name !== m.ingame_name ? " (" + m.display_name + ")" : "")}
                    </option>
                  ))}
                </select>
                <button onClick={handleClaim} disabled={!selectedStarterId || submitting}
                  className="w-full py-2 px-4 font-medium rounded-lg text-sm"
                  style={{ background: "rgba(201,168,76,0.2)", border: "0.5px solid rgba(201,168,76,0.35)", color: "#E8C87A", cursor: !selectedStarterId || submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Einreichen..." : "Zuordnung beantragen"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-center" style={{ color: "rgba(201,168,76,0.3)" }}>Keine offenen Einträge vorhanden.</p>
            )}
            <button onClick={() => setStep("success")} disabled={submitting}
              className="w-full py-2 px-4 rounded-lg text-sm transition-colors"
              style={{ background: "#1C1508", border: "0.5px solid rgba(201,168,76,0.12)", color: "rgba(201,168,76,0.4)" }}>
              Überspringen – ich bin neu im Clan
            </button>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="rounded-lg p-6 text-center space-y-4" style={{ background: "#111111", border: "0.5px solid rgba(201,168,76,0.2)" }}>
            <div className="text-4xl">✓</div>
            <h2 className="text-lg font-semibold" style={{ color: "#E8C87A", fontFamily: "Georgia, serif" }}>Willkommen bei TGM Consigliere!</h2>
            {claimDone ? (
              <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>Zuordnung eingereicht – wartet auf Admin-Bestätigung. Du wirst weitergeleitet...</p>
            ) : (
              <p className="text-sm" style={{ color: "rgba(201,168,76,0.4)" }}>Dein Konto wurde erstellt. Du wirst gleich weitergeleitet...</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
