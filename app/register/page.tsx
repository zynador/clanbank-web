"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";

type Step = "code" | "details" | "claim" | "success";

interface StarterMember {
  id: string
  ingame_name: string
  display_name: string | null
}

export default function RegisterPage() {
  const { signUp, session, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("code");

  // Step 1: Invite code
  const [inviteCode, setInviteCode] = useState("");
  const [clanName, setClanName] = useState("");
  const [clanId, setClanId] = useState("");

  // Step 2: User details
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ingameName, setIngameName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Schritt 3: Starter-Mitglied Claim
  const [starterMembers, setStarterMembers] = useState<StarterMember[]>([])
  const [selectedStarterId, setSelectedStarterId] = useState<string>("")
  const [claimDone, setClaimDone] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && session && step === "code") {
    router.replace("/dashboard");
  }
  }, [session, loading, router, step]);

  // Step 1: Validate invite code
  async function handleValidateCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: rpcError } = await supabase.rpc(
      "validate_clan_code",
      { input_code: inviteCode.trim().toUpperCase() }
    );

    setSubmitting(false);

    if (rpcError) {
      setError("Fehler bei der Code-Prüfung: " + rpcError.message);
      return;
    }

    if (!data || !data.valid) {
      setError(data?.error || "Ungültiger oder bereits verwendeter Code.");
      return;
    }

    setClanName(data.clan_name);
    setClanId(data.clan_id);
    setStep("details");
  }

  // Step 2: Register
  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    if (username.length < 3) {
      setError("Benutzername muss mindestens 3 Zeichen lang sein.");
      return;
    }

    setSubmitting(true);

    const { error: signUpError } = await signUp({
      username,
      password,
      displayName: displayName || username,
      ingameName: ingameName || username,
      inviteCode: inviteCode.trim().toUpperCase(),
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    // Starter-Mitglieder für Claim-Schritt laden
    const { data: starters } = await supabase
      .from("starter_members")
      .select("id, ingame_name, display_name")
      .eq("status", "unclaimed")
      .order("ingame_name")
    setStarterMembers((starters as StarterMember[]) || [])
    setStep("claim")
  }

  // Step 3: Claim starter profile
  async function handleClaim() {
    if (!selectedStarterId) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc("claim_starter_profile", {
      starter_id: selectedStarterId,
    })
    setSubmitting(false)
    if (rpcError || !data?.success) {
      setError(rpcError?.message || data?.message || "Fehler beim Einreichen.")
      return
    }
    setClaimDone(true)
    setStep("success")
  }

  // Redirect nach Erfolg
  useEffect(() => {
    if (step === "success") {
      const t = setTimeout(() => router.replace("/dashboard"), 2500)
      return () => clearTimeout(t)
    }
  }, [step, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex justify-center">
          <Logo variant="large" />
        </div>

        {/* Step 1: Code */}
        {step === "code" && (
          <form onSubmit={handleValidateCode} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-100 text-center">
              Registrierung
            </h2>
            <p className="text-sm text-gray-400 text-center">
              Gib deinen Einladungscode ein, um fortzufahren.
            </p>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300 mb-1">
                Einladungscode
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                maxLength={10}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-center tracking-widest text-lg"
                placeholder="XXXXXX"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || inviteCode.length < 4}
              className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? "Prüfe..." : "Code prüfen"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Bereits registriert?{" "}
              <Link href="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
                Anmelden
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-teal-900/20 border border-teal-800/50 rounded-lg p-3 text-center">
              <p className="text-sm text-teal-300">
                Clan: <span className="font-semibold">{clanName}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Benutzername *
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Dein Login-Name"
              />
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                Anzeigename
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Wird in der App angezeigt"
              />
            </div>

            <div>
              <label htmlFor="ingameName" className="block text-sm font-medium text-gray-300 mb-1">
                Ingame-Name
              </label>
              <input
                id="ingameName"
                type="text"
                value={ingameName}
                onChange={(e) => setIngameName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Dein Name im Spiel"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Passwort *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-300 mb-1">
                Passwort wiederholen *
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Passwort bestätigen"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("code"); setError(null); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {submitting ? "Registriere..." : "Registrieren"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Starter-Mitglied Claim */}
        {step === "claim" && (
          <div className="space-y-5">
            <div className="bg-teal-900/20 border border-teal-800/50 rounded-lg p-3 text-center">
              <p className="text-sm text-teal-300">Registrierung erfolgreich ✓</p>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold text-gray-100">
                Bist du bereits Clan-Mitglied?
              </h2>
              <p className="text-sm text-gray-400">
                Wähle deinen Namen aus der Clan-Liste, falls du bereits eingetragen bist.
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {starterMembers.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedStarterId}
                  onChange={(e) => { setSelectedStarterId(e.target.value); setError(null); }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">— Ich bin nicht in der Liste —</option>
                  {starterMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ingame_name}
                      {m.display_name && m.display_name !== m.ingame_name
                        ? " (" + m.display_name + ")"
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleClaim}
                  disabled={!selectedStarterId || submitting}
                  className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {submitting ? "Einreichen..." : "Zuordnung beantragen"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">
                Keine offenen Einträge in der Clan-Liste vorhanden.
              </p>
            )}

            <button
              onClick={() => setStep("success")}
              disabled={submitting}
              className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
            >
              Überspringen – ich bin neu im Clan
            </button>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <h2 className="text-lg font-semibold text-gray-100">
              Willkommen in der Clanbank!
            </h2>
            {claimDone ? (
              <p className="text-sm text-amber-400">
                Zuordnung eingereicht – wartet auf Admin-Bestätigung. Du wirst weitergeleitet...
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Dein Konto wurde erstellt. Du wirst gleich weitergeleitet...
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
