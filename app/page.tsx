"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Member = {
  id: string;
  ingame_name: string;
  role: "boss" | "banker" | "officer" | "member";
};

type Tx = {
  id: string;
  member_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  approved: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export default function Page() {
  const [log, setLog] = useState<string>("");

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);

  const [ingame, setIngame] = useState("Member1");
  const [codeword, setCodeword] = useState("member123");

  const [txType, setTxType] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState<number>(100);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");

  const [myTx, setMyTx] = useState<Tx[]>([]);
  const [latestTxId, setLatestTxId] = useState<string>("");

  const isApprover = useMemo(
    () => member?.role === "boss" || member?.role === "banker",
    [member?.role]
  );

  function out(label: string, payload: unknown) {
    setLog(
      `[${new Date().toLocaleTimeString()}] ${label}\n` +
        (typeof payload === "string" ? payload : JSON.stringify(payload, null, 2))
    );
  }

  async function refreshSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) out("ERROR: getSession", error);
    setSessionUserId(data.session?.user?.id ?? null);
  }

  async function loadMyMember() {
    const { data, error } = await supabase
      .from("members")
      .select("id, ingame_name, role")
      .limit(1);

    if (error) {
      setMember(null);
      out("ERROR: loadMyMember", error);
      return;
    }

    setMember((data?.[0] as Member) ?? null);
  }

  async function loadMyTx() {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, member_id, type, amount, approved, created_at, approved_at, approved_by")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return out("ERROR: loadMyTx", error);

    setMyTx((data as Tx[]) ?? []);
    const last = (data as Tx[])?.[0];
    setLatestTxId(last?.id ?? "");
  }

  useEffect(() => {
    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function anonSignIn() {
    out("RUN: Anonymous sign-in", "...");
    const res = await supabase.auth.signInAnonymously();
    out("RESULT: Anonymous sign-in", res);
    await refreshSession();
    setMember(null);
    setMyTx([]);
  }

  async function signOut() {
    out("RUN: Sign out", "...");
    const res = await supabase.auth.signOut();
    out("RESULT: Sign out", res);
    await refreshSession();
    setMember(null);
    setMyTx([]);
  }

  async function claim() {
    out("RUN: Claim", "...");
    const res = await supabase.rpc("claim_member", {
      p_ingame_name: ingame.trim(),
      p_codeword: codeword,
    });
    out("RESULT: Claim", res);

    if (!res.error) {
      await loadMyMember();
      await loadMyTx();
    }
  }

  async function createTx() {
    if (!member) return out("ERROR: createTx", "Erst claimen.");

    if (!(amount > 0)) return out("ERROR: createTx", "Betrag muss > 0 sein.");

    out("RUN: Create transaction", "...");
    const res = await supabase
      .from("transactions")
      .insert([
        {
          member_id: member.id,
          type: txType,
          amount,
          screenshot_url: screenshotUrl.trim() || null,
        },
      ])
      .select();

    out("RESULT: Create transaction", res);
    if (!res.error) await loadMyTx();
  }

  async function approve(txId?: string) {
    if (!isApprover) return out("ERROR: approve", "Nur boss/banker dürfen freigeben.");

    const id = (txId || latestTxId).trim();
    if (!id) return out("ERROR: approve", "Keine Tx-ID gefunden.");

    out("RUN: Approve", { id });
    const res = await supabase.from("transactions").update({ approved: true }).eq("id", id).select();
    out("RESULT: Approve", res);
    if (!res.error) await loadMyTx();
  }

  async function changeMyCodeword(oldPw: string, newPw: string) {
    out("RUN: change_my_codeword", "...");
    const res = await supabase.rpc("change_my_codeword", { p_old: oldPw, p_new: newPw });
    out("RESULT: change_my_codeword", res);
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Clanbank MVP</h1>

      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border px-3 py-2" onClick={anonSignIn}>
            Anonymous sign-in
          </button>
          <button className="rounded-lg border px-3 py-2" onClick={signOut}>
            Sign out
          </button>
          <button className="rounded-lg border px-3 py-2" onClick={loadMyMember}>
            My member laden
          </button>
          <button className="rounded-lg border px-3 py-2" onClick={loadMyTx}>
            My transactions laden
          </button>
        </div>

        <div className="text-sm">
          <div>
            <span className="font-medium">Session user:</span>{" "}
            {sessionUserId ? sessionUserId : "— (nicht eingeloggt)"}
          </div>
          <div>
            <span className="font-medium">Member:</span>{" "}
            {member ? `${member.ingame_name} (${member.role})` : "— (nicht geclaimed)"}
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Claim</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded-lg border px-3 py-2"
            value={ingame}
            onChange={(e) => setIngame(e.target.value)}
            placeholder="Ingame-Name (z.B. Member1)"
          />
          <input
            className="rounded-lg border px-3 py-2"
            value={codeword}
            onChange={(e) => setCodeword(e.target.value)}
            placeholder="Codewort"
            type="password"
          />
        </div>

        <button className="rounded-lg border px-3 py-2" onClick={claim}>
          Claim Member
        </button>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Transaktion</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="rounded-lg border px-3 py-2"
            value={txType}
            onChange={(e) => setTxType(e.target.value as any)}
          >
            <option value="deposit">deposit</option>
            <option value="withdrawal">withdrawal</option>
          </select>

          <input
            className="rounded-lg border px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Amount"
            inputMode="decimal"
          />

          <input
            className="rounded-lg border px-3 py-2"
            value={screenshotUrl}
            onChange={(e) => setScreenshotUrl(e.target.value)}
            placeholder="Screenshot URL (optional)"
          />
        </div>

        <button className="rounded-lg border px-3 py-2" onClick={createTx}>
          Transaktion erstellen
        </button>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Approver</h2>
        <div className="text-sm">
          Latest Tx ID: <span className="font-mono">{latestTxId || "—"}</span>
        </div>
        <button className="rounded-lg border px-3 py-2" onClick={() => approve()}>
          Letzte Transaktion freigeben
        </button>
        {!isApprover && <div className="text-sm text-gray-600">Nur boss/banker dürfen freigeben.</div>}
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Meine Transaktionen (letzte 20)</h2>
        <div className="space-y-2">
          {myTx.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="font-mono">{t.id}</div>
              <div>
                <span className="font-medium">{t.type}</span> — {t.amount} —{" "}
                {t.approved ? "✅ approved" : "⏳ pending"}
              </div>
              <div className="text-gray-600">{t.created_at}</div>
            </div>
          ))}
          {myTx.length === 0 && <div className="text-sm text-gray-600">Noch keine Daten.</div>}
        </div>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Debug Output</h2>
        <pre className="rounded-lg bg-gray-50 p-3 text-xs overflow-auto">{log || "—"}</pre>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Passwort wechseln</h2>
        <PasswortWechsel onSubmit={changeMyCodeword} />
      </section>
    </main>
  );
}

function PasswortWechsel({
  onSubmit,
}: {
  onSubmit: (oldPw: string, newPw: string) => Promise<void>;
}) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="rounded-lg border px-3 py-2"
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
          placeholder="Altes Codewort"
          type="password"
        />
        <input
          className="rounded-lg border px-3 py-2"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="Neues Codewort (min 6)"
          type="password"
        />
      </div>
      <button className="rounded-lg border px-3 py-2" onClick={() => onSubmit(oldPw, newPw)}>
        Codewort ändern
      </button>
    </div>
  );
}