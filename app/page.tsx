"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Step = "code" | "details" | "success";

export default function RegisterPage() {
  const { signUp, session, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("code");

  // Step 1: Invite code
  const [inviteCode, setInviteCode] = useState("");
  const [clanName, setClanName] = useState("");
  const [clanId, setClanId] = useState("");

  // Step 2: User details (no email)
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ingameName, setIngameName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [session, loading, router]);

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

    if (!data.valid) {
      setError(data.error || "Ungültiger oder bereits verwendeter Code.");
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

    // Client-side validation
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

    const { error } = await signUp({
      password,
      inviteCode: inviteCode.trim().toUpperCase(),
      username,
      displayName: displayName || username,
      ingameName,
    });

    if (error) {
      setError(error);
      setSubmitting(false);
    } else {
      setStep("success");
      setSubmitting(false);
      // Auto-redirect after short delay
      setTimeout(() => router.replace("/dashboard"), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500 tracking-tight">
            Clanbank
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Neues Konto erstellen</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className={`w-8 h-1 rounded-full transition-colors ${
              step === "code" ? "bg-amber-500" : "bg-amber-600"
            }`}
          />
          <div
            className={`w-8 h-1 rounded-full transition-colors ${
              step === "details" || step === "success"
                ? "bg-amber-500"
                : "bg-gray-700"
            }`}
          />
        </div>

        {/* Step 1: Invite Code */}
        {step === "code" && (
          <form
            onSubmit={handleValidateCode}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-100">
              Einladungscode
            </h2>
            <p className="text-sm text-gray-400">
              Du benötigst einen Einladungscode von deinem Clan-Admin, um dich
              zu registrieren.
            </p>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm text-gray-400 mb-1"
              >
                Code
              </label>
              <input
                id="inviteCode"
                type="text"
                required
                maxLength={10}
                value={inviteCode}
                onChange={(e) =>
                  setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-center text-xl font-mono tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors uppercase"
                placeholder="CODE"
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || inviteCode.length < 4}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition-colors"
            >
              {submitting ? "Prüfe..." : "Code prüfen"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Bereits registriert?{" "}
              <Link
                href="/login"
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                Anmelden
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: User Details */}
        {step === "details" && (
          <form
            onSubmit={handleRegister}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                Konto erstellen
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Clan:{" "}
                <span className="text-amber-500 font-medium">{clanName}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-sm text-gray-400 mb-1"
              >
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="mein_name"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="block text-sm text-gray-400 mb-1"
              >
                Anzeigename{" "}
                <span className="text-gray-600">(optional)</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Wird anderen angezeigt"
              />
            </div>

            <div>
              <label
                htmlFor="ingameName"
                className="block text-sm text-gray-400 mb-1"
              >
                Ingame-Name
              </label>
              <input
                id="ingameName"
                type="text"
                required
                value={ingameName}
                onChange={(e) => setIngameName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Dein Name im Spiel"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm text-gray-400 mb-1"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Min. 6 Zeichen"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm text-gray-400 mb-1"
              >
                Passwort bestätigen
              </label>
              <input
                id="passwordConfirm"
                type="password"
                required
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("code");
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition-colors"
              >
                {submitting ? "Registriere..." : "Registrieren"}
              </button>
            </div>
          </form>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <h2 className="text-lg font-semibold text-gray-100">
              Willkommen in der Clanbank!
            </h2>
            <p className="text-sm text-gray-400">
              Dein Konto wurde erstellt. Du wirst gleich weitergeleitet...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
