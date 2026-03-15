"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ───────────────────────────────────────────────────────────────────
type ResourceType = "Cash" | "Arms" | "Cargo" | "Metal" | "Diamond";

interface DepositRow {
  id: string;
  user_id: string;
  resource_type: ResourceType;
  amount: number;
  created_at: string;
  profiles: { display_name: string; ingame_name: string; username: string } | null;
}

interface PlayerTotal {
  user_id: string;
  display_name: string;
  ingame_name: string;
  total: number;
  byResource: Record<ResourceType, number>;
}

interface ResourceTotal {
  type: ResourceType;
  total: number;
  count: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────
const RESOURCE_CONFIG: Record<
  ResourceType,
  { label: string; icon: string; color: string }
> = {
  Cash: { label: "Cash", icon: "/cash.png", color: "#22c55e" },
  Arms: { label: "Arms", icon: "/arms.png", color: "#ef4444" },
  Cargo: { label: "Cargo", icon: "/cargo.png", color: "#3b82f6" },
  Metal: { label: "Metal", icon: "/metal.png", color: "#a855f7" },
  Diamond: { label: "Diamond", icon: "/diamond.png", color: "#06b6d4" },
};

const RESOURCES: ResourceType[] = [
  "Cash",
  "Arms",
  "Cargo",
  "Metal",
  "Diamond",
];

type TimeFilter = "current_month" | "last_month" | "all_time" | "custom";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDateRange(
  filter: TimeFilter,
  customFrom?: string,
  customTo?: string
) {
  const now = new Date();
  switch (filter) {
    case "current_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "custom": {
      return {
        from: customFrom
          ? new Date(customFrom).toISOString()
          : new Date(2020, 0, 1).toISOString(),
        to: customTo
          ? new Date(customTo + "T23:59:59").toISOString()
          : now.toISOString(),
      };
    }
    default:
      return { from: null, to: null };
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000)
    return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("de-DE");
}

function getFilterLabel(filter: TimeFilter): string {
  switch (filter) {
    case "current_month":
      return "Aktueller Monat";
    case "last_month":
      return "Letzter Monat";
    case "all_time":
      return "Gesamtzeitraum";
    case "custom":
      return "Benutzerdefiniert";
  }
}

// ─── Bar Chart (pure CSS) ────────────────────────────────────────────────────
function ResourceBarChart({ data }: { data: ResourceTotal[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.total / maxVal) * 100;
        const cfg = RESOURCE_CONFIG[d.type];
        return (
          <div key={d.type} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <img src={cfg.icon} alt={cfg.label} className="w-5 h-5" />
                <span className="text-sm font-medium text-zinc-200">
                  {cfg.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-zinc-100">
                  {formatNumber(d.total)}
                </span>
                <span className="text-xs text-zinc-500 ml-2">
                  ({d.count}x)
                </span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-zinc-800/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: cfg.color,
                  boxShadow: `0 0 8px ${cfg.color}40`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ranking Medal ───────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold">
      {rank}
    </span>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────────
export default function Dashboard() {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all_time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<"ranking" | "resources">(
    "ranking"
  );

  // ─── Fetch deposits ──────────────────────────────────────────────────────
  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("deposits")
        .select(
          "id, user_id, resource_type, amount, created_at, profiles!deposits_user_id_fkey(display_name, ingame_name, username)"
        )
        .is("deleted_at", null)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      const range = getDateRange(timeFilter, customFrom, customTo);
      if (range.from) query = query.gte("created_at", range.from);
      if (range.to) query = query.lte("created_at", range.to);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error("Dashboard fetch error:", fetchError);
        setError("Fehler beim Laden der Daten. Bitte versuche es erneut.");
        setDeposits([]);
      } else {
        setDeposits((data as unknown as DepositRow[]) || []);
      }
    } catch (err) {
      console.error("Dashboard fetch exception:", err);
      setError("Verbindungsfehler. Bitte prüfe deine Internetverbindung.");
      setDeposits([]);
    }

    setLoading(false);
  }, [timeFilter, customFrom, customTo]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  // ─── Compute stats ───────────────────────────────────────────────────────
  const playerMap = new Map<string, PlayerTotal>();
  for (const d of deposits) {
    const existing = playerMap.get(d.user_id);
    if (existing) {
      existing.total += Number(d.amount);
      existing.byResource[d.resource_type] =
        (existing.byResource[d.resource_type] || 0) + Number(d.amount);
    } else {
      const profile = d.profiles as {
        display_name: string;
        ingame_name: string;
        username: string;
      } | null;
      const byResource = {
        Cash: 0,
        Arms: 0,
        Cargo: 0,
        Metal: 0,
        Diamond: 0,
      } as Record<ResourceType, number>;
      byResource[d.resource_type] = Number(d.amount);
      playerMap.set(d.user_id, {
        user_id: d.user_id,
        display_name: profile?.display_name || profile?.username || "Unbekannt",
        ingame_name: profile?.ingame_name || profile?.username || "Unbekannt",
        total: Number(d.amount),
        byResource,
      });
    }
  }

  const playerRanking = Array.from(playerMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const resourceTotals: ResourceTotal[] = RESOURCES.map((type) => {
    const matching = deposits.filter((d) => d.resource_type === type);
    return {
      type,
      total: matching.reduce((sum, d) => sum + Number(d.amount), 0),
      count: matching.length,
    };
  }).sort((a, b) => b.total - a.total);

  const totalDeposits = deposits.length;
  const totalAmount = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalPlayers = playerMap.size;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Einzahlungen"
          value={totalDeposits.toString()}
          sub="Transaktionen"
          accent="#3b82f6"
        />
        <StatCard
          label="Gesamtvolumen"
          value={formatNumber(totalAmount)}
          sub="Alle Ressourcen"
          accent="#22c55e"
        />
        <StatCard
          label="Aktive Spieler"
          value={totalPlayers.toString()}
          sub="mit Einzahlungen"
          accent="#a855f7"
        />
      </div>

      {/* ── Time filter ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2">
            Zeitraum:
          </span>
          {(
            ["all_time", "current_month", "last_month", "custom"] as TimeFilter[]
          ).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                timeFilter === f
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>
        {timeFilter === "custom" && (
          <div className="flex flex-wrap gap-3 mt-3 items-center">
            <label className="text-sm text-zinc-400">
              Von:
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Bis:
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Error state ─────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchDeposits}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
          >
            Erneut laden
          </button>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-zinc-400">Lade Daten...</span>
        </div>
      ) : deposits.length === 0 && !error ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-lg">
            Keine Einzahlungen im gewählten Zeitraum
          </p>
          <p className="text-zinc-600 text-sm mt-1">
            Wähle einen anderen Zeitraum oder erstelle eine Einzahlung.
          </p>
        </div>
      ) : (
        !error && (
          <>
            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setActiveTab("ranking")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "ranking"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Spieler-Ranking
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "resources"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Ressourcen-Übersicht
              </button>
            </div>

            {/* ── Ranking Tab ───────────────────────────────────────── */}
            {activeTab === "ranking" && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-xs text-zinc-500 uppercase tracking-wider font-semibold px-4 py-3 w-12">
                          #
                        </th>
                        <th className="text-left text-xs text-zinc-500 uppercase tracking-wider font-semibold px-4 py-3">
                          Spieler
                        </th>
                        {RESOURCES.map((r) => (
                          <th
                            key={r}
                            className="text-right text-xs text-zinc-500 uppercase tracking-wider font-semibold px-4 py-3"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <img
                                src={RESOURCE_CONFIG[r].icon}
                                alt={r}
                                className="w-4 h-4"
                              />
                              <span>{r}</span>
                            </div>
                          </th>
                        ))}
                        <th className="text-right text-xs text-zinc-500 uppercase tracking-wider font-semibold px-4 py-3">
                          Gesamt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerRanking.map((player, i) => (
                        <tr
                          key={player.user_id}
                          className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${
                            i < 3 ? "bg-zinc-800/10" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={i + 1} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-zinc-200">
                              {player.ingame_name}
                            </span>
                          </td>
                          {RESOURCES.map((r) => (
                            <td key={r} className="text-right px-4 py-3">
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    player.byResource[r] > 0
                                      ? RESOURCE_CONFIG[r].color
                                      : "#52525b",
                                }}
                              >
                                {player.byResource[r] > 0
                                  ? formatNumber(player.byResource[r])
                                  : "—"}
                              </span>
                            </td>
                          ))}
                          <td className="text-right px-4 py-3">
                            <span className="text-sm font-bold text-zinc-100">
                              {formatNumber(player.total)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-zinc-800">
                  {playerRanking.map((player, i) => (
                    <div key={player.user_id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <RankBadge rank={i + 1} />
                          <span className="text-sm font-medium text-zinc-200">
                            {player.ingame_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-zinc-100">
                          {formatNumber(player.total)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {RESOURCES.map(
                          (r) =>
                            player.byResource[r] > 0 && (
                              <span
                                key={r}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-800/60"
                              >
                                <img
                                  src={RESOURCE_CONFIG[r].icon}
                                  alt={r}
                                  className="w-3.5 h-3.5"
                                />
                                <span
                                  style={{ color: RESOURCE_CONFIG[r].color }}
                                >
                                  {formatNumber(player.byResource[r])}
                                </span>
                              </span>
                            )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Resources Tab ─────────────────────────────────────── */}
            {activeTab === "resources" && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                <ResourceBarChart data={resourceTotals} />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-0.5"
        style={{ backgroundColor: accent }}
      />
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-100 mt-1">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
    </div>
  );
}
