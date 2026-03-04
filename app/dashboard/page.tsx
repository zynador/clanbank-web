"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/components/Dashboard";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = "admin" | "offizier" | "mitglied";

interface MemberRow {
  id: string;
  username: string;
  display_name: string;
  ingame_name: string;
  role: UserRole;
  created_at: string;
}

// ─── Admin Panel ─────────────────────────────────────────────────────────────

function AdminPanel() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("mitglied");
  const [editIngame, setEditIngame] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, ingame_name, role, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching members:", error);
    } else {
      setMembers((data as MemberRow[]) || []);
    }
    setLoading(false);
  }

  async function handleUpdateMember(memberId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: editRole, ingame_name: editIngame })
      .eq("id", memberId);

    if (error) {
      alert("Fehler beim Aktualisieren: " + error.message);
    } else {
      setEditingId(null);
      fetchMembers();
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    const { data, error } = await supabase.rpc("generate_invite_code");
    if (error) {
      alert("Fehler beim Erstellen des Codes: " + error.message);
    } else {
      setInviteCode(data as string);
    }
    setGeneratingCode(false);
  }

  function startEdit(member: MemberRow) {
    setEditingId(member.id);
    setEditRole(member.role);
    setEditIngame(member.ingame_name || "");
  }

  const roleLabels: Record<UserRole, string> = {
    admin: "Admin",
    offizier: "Offizier",
    mitglied: "Mitglied",
  };

  const roleBadgeStyles: Record<UserRole, string> = {
    admin: "bg-red-500/15 text-red-400 border-red-500/20",
    offizier: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    mitglied: "bg-zinc-700/30 text-zinc-400 border-zinc-600/20",
  };

  return (
    <div className="space-y-6">
      {/* Generate invite code */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Einladungscode erstellen</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateCode}
            disabled={generatingCode}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generatingCode ? "Erstelle..." : "Code generieren"}
          </button>
          {inviteCode && (
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-lg tracking-widest">
                {inviteCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                }}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
              >
                Kopieren
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Members list */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Mitglieder ({members.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {members.map((member) => (
              <div key={member.id} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <label className="text-sm text-zinc-400">
                        Ingame-Name:
                        <input
                          type="text"
                          value={editIngame}
                          onChange={(e) => setEditIngame(e.target.value)}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="text-sm text-zinc-400">
                        Rolle:
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="mitglied">Mitglied</option>
                          <option value="offizier">Offizier</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateMember(member.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-sm font-medium text-zinc-200">{member.ingame_name || member.display_name}</span>
                        <span className="text-xs text-zinc-500 ml-2">@{member.username}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadgeStyles[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                    </div>
                    <button
                      onClick={() => startEdit(member)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Bearbeiten
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type PageTab = "dashboard" | "admin";

function DashboardPage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PageTab>("dashboard");
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Clanbank</h1>
              <nav className="hidden sm:flex items-center gap-1 ml-4">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "dashboard"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push("/deposits")}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-all"
                >
                  Einzahlungen
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "admin"
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Verwaltung
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400 hidden sm:inline">
                {profile?.ingame_name || profile?.display_name}
              </span>
              <button
                onClick={signOut}
                className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all"
              >
                Abmelden
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          <div className="sm:hidden flex gap-1 pb-2 -mt-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "dashboard"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/deposits")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 whitespace-nowrap"
            >
              Einzahlungen
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === "admin"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400"
                }`}
              >
                Verwaltung
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "admin" && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}

export default function DashboardPageWrapper() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
