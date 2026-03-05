"use client";

import { useAuth, Profile } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";
import Link from "next/link";

function DashboardContent() {
  const { profile, signOut } = useAuth();

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    offizier: "Offizier",
    mitglied: "Mitglied",
  };

  const isAdmin = profile?.role === "admin";
  const isOfficer = profile?.role === "offizier";

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo variant="small" />
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
              Ingame: <span className="text-gray-200">{profile?.ingame_name || "—"}</span>
              {" · "}
              Rolle: <span className="text-gray-200">{roleLabels[profile?.role || "mitglied"]}</span>
            </p>
          </div>

          {/* Navigation cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/deposits" className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-teal-700 transition-colors">
              <h3 className="text-sm font-medium text-teal-400 mb-1">
                Einzahlungen
              </h3>
              <p className="text-sm text-gray-400">
                Neue Einzahlung erfassen und bisherige anzeigen
              </p>
            </Link>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                Auswertungen
              </h3>
              <p className="text-sm text-gray-400">
                Kommt in Schritt 5
              </p>
            </div>
          </div>

          {/* Offizier hint */}
          {isOfficer && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                Als Offizier kannst du Einträge anderer Mitglieder einsehen und bearbeiten.
              </p>
            </div>
          )}

          {/* Admin Panel */}
          {isAdmin && <AdminPanel />}
        </div>
      </main>
    </div>
  );
}

// Admin Panel Component
function AdminPanel() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editIngame, setEditIngame] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    offizier: "Offizier",
    mitglied: "Mitglied",
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("username", { ascending: true });

    if (error) {
      setError("Fehler beim Laden: " + error.message);
    } else {
      setMembers(data as Profile[]);
    }
    setLoading(false);
  }

  function startEdit(member: Profile) {
    setEditingId(member.id);
    setEditRole(member.role);
    setEditIngame(member.ingame_name || "");
    setSuccessMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRole("");
    setEditIngame("");
  }

  async function saveEdit(memberId: string) {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        role: editRole,
        ingame_name: editIngame,
      })
      .eq("id", memberId);

    if (error) {
      setError("Fehler beim Speichern: " + error.message);
    } else {
      setSuccessMsg("Änderungen gespeichert!");
      setEditingId(null);
      loadMembers();
    }
    setSaving(false);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          Admin · Mitgliederverwaltung
        </h3>
        <span className="text-xs text-gray-500">
          {members.length} Mitglieder
        </span>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-900/30 border border-green-800 text-green-300 text-sm rounded px-3 py-2 mb-4">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">
                  Benutzername
                </th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">
                  Ingame-Name
                </th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">
                  Rolle
                </th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  {editingId === member.id ? (
                    <>
                      <td className="py-2 px-2 text-gray-200">
                        {member.username}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={editIngame}
                          onChange={(e) => setEditIngame(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-sm w-full focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-teal-500"
                        >
                          <option value="mitglied">Mitglied</option>
                          <option value="offizier">Offizier</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => saveEdit(member.id)}
                            disabled={saving}
                            className="text-xs bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white px-3 py-1 rounded transition-colors"
                          >
                            {saving ? "..." : "Speichern"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-2 text-gray-200">
                        {member.username}
                      </td>
                      <td className="py-2 px-2 text-gray-300">
                        {member.ingame_name || "—"}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            member.role === "admin"
                              ? "bg-teal-900/50 text-teal-300"
                              : member.role === "offizier"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {roleLabels[member.role]}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => startEdit(member)}
                          className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                        >
                          Bearbeiten
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
