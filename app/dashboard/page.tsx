"use client";

import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";

function DashboardContent() {
  const { profile, signOut } = useAuth();

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    offizier: "Offizier",
    mitglied: "Mitglied",
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-amber-500">Clanbank</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {profile?.display_name || profile?.username}
              <span className="ml-2 text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                {roleLabels[profile?.role || "mitglied"]}
              </span>
            </span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Welcome */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-2">
              Willkommen, {profile?.display_name || profile?.username}!
            </h2>
            <p className="text-gray-400 text-sm">
              Ingame: <span className="text-gray-200">{profile?.ingame_name}</span>
              {" · "}
              Rolle: <span className="text-gray-200">{roleLabels[profile?.role || "mitglied"]}</span>
            </p>
          </div>

          {/* Placeholder cards for future features */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                Einzahlungen
              </h3>
              <p className="text-2xl font-bold text-gray-100">—</p>
              <p className="text-xs text-gray-600 mt-2">
                Schritt 4 · Kommt als Nächstes
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                Auswertungen
              </h3>
              <p className="text-2xl font-bold text-gray-100">—</p>
              <p className="text-xs text-gray-600 mt-2">
                Schritt 5 · Dashboard
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
