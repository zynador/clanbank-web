"use client"

import { useState, FormEvent, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import Logo from "@/components/Logo"

type Step = "code" | "credentials" | "name" | "success"
type NameMode = "list" | "manual"
type SuccessType = "claimed" | "manual"

interface StarterMember { id: string; ingame_name: string }

const G = {
  bg: '#0C0A08',
  bg3: '#1C1508',
  border: 'rgba(201,168,76,0.18)',
  borderHi: 'rgba(201,168,76,0.35)',
  gold: '#E8C87A',
  goldMid: 'rgba(201,168,76,0.55)',
  goldLow: 'rgba(201,168,76,0.3)',
  goldFaint: 'rgba(201,168,76,0.15)',
}

function InputField({ id, label, type = 'text', value, onChange, required = false, placeholder }: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: G.goldMid }}>{label}
      </label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
        style={{ background: G.bg3, border: '0.5px solid ' + G.border, color: G.gold }}
      />
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
      {msg}
    </div>
  )
}

function ClanBadge({ name }: { name: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: G.goldFaint, border: '0.5px solid ' + G.border }}>
      <p className="text-sm" style={{ color: G.goldMid }}>
        {'Clan: '}
        <span className="font-semibold" style={{ color: G.gold }}>{name}</span>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  const { signUp, session, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>("code")
  const [inviteCode, setInviteCode] = useState("")
  const [clanName, setClanName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [starterMembers, setStarterMembers] = useState<StarterMember[]>([])
  const [selectedStarterId, setSelectedStarterId] = useState<string>("")
  const [nameMode, setNameMode] = useState<NameMode>("list")
  const [manualName, setManualName] = useState("")
  const [successType, setSuccessType] = useState<SuccessType>("claimed")
  const [loadingStarters, setLoadingStarters] = useState(false)

  useEffect(() => {
    if (!loading && session && step === "code") router.replace("/dashboard")
  }, [session, loading, router, step])

  useEffect(() => {
    if (step !== "success") return
    const t = setTimeout(() => router.replace("/dashboard"), 3000)
    return () => clearTimeout(t)
  }, [step, router])

  async function handleValidateCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { data, error: rpcError } = await supabase.rpc("validate_clan_code", {
      input_code: inviteCode.trim().toUpperCase(),
    })
    setSubmitting(false)
    if (rpcError) { setError("Fehler bei der Code-Prüfung: " + rpcError.message); return }
    if (!data?.valid) { setError(data?.error || "Ungültiger oder bereits verwendeter Code."); return }
    setClanName(data.clan_name)
    setStep("credentials")
  }

  // Wird nach signUp aufgerufen — User ist jetzt authentifiziert → RLS erlaubt Zugriff
  async function fetchStarters() {
    setLoadingStarters(true)
    const { data } = await supabase
      .from("starter_members").select("id, ingame_name")
      .eq("status", "unclaimed").order("ingame_name")
    const starters = (data as StarterMember[]) || []
    setStarterMembers(starters)
    if (starters.length === 0) setNameMode("manual")
    setLoadingStarters(false)
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirm) { setError("Passwörter stimmen nicht überein."); return }
    if (password.length < 6) { setError("Passwort muss mindestens 6 Zeichen lang sein."); return }
    if (username.length < 3) { setError("Benutzername muss mindestens 3 Zeichen lang sein."); return }
    setSubmitting(true)
    // ingameName wird in Schritt 3 gesetzt — Platzhalter = username
    const { error: signUpError } = await signUp({
      username, password, displayName: username,
      ingameName: username,
      inviteCode: inviteCode.trim().toUpperCase(),
    })
    if (signUpError) { setError(signUpError); setSubmitting(false); return }
    // Jetzt authentifiziert → starter_members lesbar
    await fetchStarters()
    setSubmitting(false)
    setStep("name")
  }

  async function updateIngameName(resolvedName: string) {
    const { error: rpcError } = await supabase.rpc("update_my_ingame_name", {
      p_ingame_name: resolvedName,
    })
    if (rpcError) {
      console.error("update_my_ingame_name Fehler:", rpcError.message)
    }
  }

  async function handleNameDone() {
    setError(null)
    const resolved = nameMode === "list"
      ? (starterMembers.find(m => m.id === selectedStarterId)?.ingame_name ?? "")
      : manualName.trim()
    if (!resolved) {
      setError(nameMode === "list"
        ? "Bitte wähle deinen Namen aus der Liste."
        : "Bitte gib deinen Ingame-Namen ein.")
      return
    }
    setSubmitting(true)
    await updateIngameName(resolved)
    if (nameMode === "list" && selectedStarterId) {
      const { data } = await supabase.rpc("claim_starter_profile", { starter_id: selectedStarterId })
      setSuccessType((data as { success: boolean })?.success ? "claimed" : "manual")
    } else {
      setSuccessType("manual")
    }
    setSubmitting(false)
    setStep("success")
  }

  const btnPrimary = {
    background: 'rgba(201,168,76,0.2)',
    border: '0.5px solid ' + G.borderHi,
    color: G.gold,
  }
  const btnSecondary = {
    background: G.bg3,
    border: '0.5px solid rgba(201,168,76,0.12)',
    color: G.goldLow,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: G.bg }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: G.gold, borderTopColor: "transparent" }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: G.bg }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center"><Logo size={48} /></div>

        {/* ── Step 1: Einladungscode ── */}
        {step === "code" && (
          <form onSubmit={handleValidateCode} className="space-y-4">
            <h2 className="text-lg font-semibold text-center"
              style={{ color: G.gold, fontFamily: "Georgia, serif" }}>Registrierung</h2>
            <p className="text-sm text-center" style={{ color: G.goldMid }}>
              Gib deinen Einladungscode ein, um fortzufahren.
            </p>
            {error && <ErrorBox msg={error} />}
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium mb-1"
                style={{ color: G.goldMid }}>Einladungscode</label>
              <input
                id="inviteCode" type="text" value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                required maxLength={10}
                className="w-full px-3 py-2 rounded-lg text-center tracking-widest text-lg focus:outline-none"
                style={{ background: G.bg3, border: '0.5px solid ' + G.border, color: G.gold }}
                placeholder="XXXXXX"
              />
            </div>
            <button type="submit" disabled={submitting || inviteCode.length < 4}
              className="w-full py-2 px-4 font-medium rounded-lg text-sm"
              style={{ ...btnPrimary, cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Prüfe..." : "Code prüfen"}
            </button>
            <p className="text-center text-sm" style={{ color: G.goldLow }}>
              {'Bereits registriert? '}
              <Link href="/login" style={{ color: G.goldMid }}>Anmelden</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Zugangsdaten ── */}
        {step === "credentials" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <ClanBadge name={clanName} />
            <h2 className="text-lg font-semibold text-center"
              style={{ color: G.gold, fontFamily: "Georgia, serif" }}>Zugangsdaten</h2>
            {error && <ErrorBox msg={error} />}
            <div className="space-y-1">
              <InputField id="username" label="Benutzername *" value={username}
                onChange={setUsername} required placeholder="Für den Login" />
              <p className="text-xs" style={{ color: G.goldLow }}>
                Nur für den Login — kann frei gewählt werden.
              </p>
            </div>
            <InputField id="password" label="Passwort *" type="password"
              value={password} onChange={setPassword} required />
            <InputField id="passwordConfirm" label="Passwort wiederholen *" type="password"
              value={passwordConfirm} onChange={setPasswordConfirm} required />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep("code"); setError(null) }}
                className="px-4 py-2 rounded-lg text-sm" style={btnSecondary}>
                Zurück
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2 px-4 font-medium rounded-lg text-sm"
                style={{ ...btnPrimary, cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "Registriere..." : "Registrieren"}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Ingame-Name wählen (jetzt authentifiziert) ── */}
        {step === "name" && (
          <div className="space-y-5">
            <ClanBadge name={clanName} />
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold"
                style={{ color: G.gold, fontFamily: "Georgia, serif" }}>Dein Ingame-Name</h2>
              <p className="text-sm" style={{ color: G.goldMid }}>
                Wähle deinen Namen aus der Clan-Liste.
              </p>
            </div>
            {error && <ErrorBox msg={error} />}
            {loadingStarters ? (
              <p className="text-center text-sm" style={{ color: G.goldMid }}>Lade Clan-Liste...</p>
            ) : nameMode === "list" && starterMembers.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedStarterId}
                  onChange={e => { setSelectedStarterId(e.target.value); setError(null) }}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: G.bg3, border: '0.5px solid ' + G.border, color: G.gold }}>
                  <option value="">— Bitte wählen —</option>
                  {starterMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.ingame_name}</option>
                  ))}
                </select>
                <button type="button"
                  onClick={() => { setNameMode("manual"); setSelectedStarterId(""); setError(null) }}
                  className="text-xs underline w-full text-center"
                  style={{ color: G.goldMid, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Mein Name steht nicht in der Liste
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg p-3"
                  style={{ background: 'rgba(180,120,0,0.12)', border: '0.5px solid rgba(201,168,76,0.3)' }}>
                  <p className="text-xs" style={{ color: G.gold }}>
                    ℹ️ Dein Name wurde noch nicht importiert. Gib ihn genau so ein wie im Spiel — ein Admin ordnet dich zu.
                  </p>
                </div>
                <InputField id="manualName" label="Dein Ingame-Name" value={manualName}
                  onChange={setManualName} required placeholder="Genau so wie im Spiel" />
                {starterMembers.length > 0 && (
                  <button type="button"
                    onClick={() => { setNameMode("list"); setManualName(""); setError(null) }}
                    className="text-xs underline w-full text-center"
                    style={{ color: G.goldMid, background: 'none', border: 'none', cursor: 'pointer' }}>
                    Zurück zur Clan-Liste
                  </button>
                )}
              </div>
            )}
            <button type="button" onClick={handleNameDone}
              disabled={submitting || loadingStarters}
              className="w-full py-2 px-4 font-medium rounded-lg text-sm"
              style={{ ...btnPrimary, cursor: submitting || loadingStarters ? "not-allowed" : "pointer" }}>
              {submitting ? "Speichere..." : "Weiter"}
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="rounded-lg p-6 text-center space-y-4"
            style={{ background: '#111111', border: '0.5px solid ' + G.border }}>
            <div className="text-4xl">✓</div>
            <h2 className="text-lg font-semibold"
              style={{ color: G.gold, fontFamily: "Georgia, serif" }}>
              Willkommen bei TGM Consigliere!
            </h2>
            {successType === "claimed" ? (
              <p className="text-sm" style={{ color: G.goldMid }}>
                Zuordnung eingereicht — ein Admin wird deinen Namen bestätigen. Du wirst weitergeleitet...
              </p>
            ) : (
              <p className="text-sm" style={{ color: G.goldMid }}>
                Konto erstellt — ein Admin ordnet deinen Ingame-Namen zu. Du wirst weitergeleitet...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
