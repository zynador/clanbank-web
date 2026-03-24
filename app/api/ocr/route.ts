import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// MODUS 1 (bestehend): Einzahlungs-Screenshots
// ─────────────────────────────────────────────
async function handleDepositOcr(base64: string, contentType: string) {
  const prompt = `Du analysierst einen Screenshot aus dem Spiel "The Grand Mafia".
Das Bild zeigt einen Ressourcen-Transport-Bericht mit mehreren Einträgen.
Jeder Eintrag besteht aus:
1. Einem Zeitstempel (Datum + Uhrzeit, z.B. "15.03. 09:15") — direkt am Eintrag sichtbar
2. Einem grünen Header: "Ressourcen senden an: [Name]"
3. Genau 5 Ressourcen-Slots nebeneinander, von LINKS nach RECHTS:
   Slot 1 = CASH, Slot 2 = ARMS, Slot 3 = CARGO, Slot 4 = METAL, Slot 5 = DIAMOND
4. Unter jedem Slot: ein Zahlenwert ODER "-"

WICHTIG - Slot-Reihenfolge:
- Slot 4 (METAL) = vierter von links = zweiter von rechts
- Slot 5 (DIAMOND) = ganz rechts außen
- Immer von links nach rechts zählen: 1, 2, 3, 4, 5

ZAHLENFORMAT: "7,25 M" = 7250000, "500 K" = 500000, "-" = 0

AUFGABE:
Schritt 1: Finde alle Einträge mit "Bam bamm" im grünen Header.
Schritt 2: Für jeden Bam-bamm-Eintrag: lies Zeitstempel, dann alle 5 Slot-Werte.
Schritt 3: Gib jeden Eintrag EINZELN aus — NICHT summieren.

Ignoriere alle "sind von"-Einträge und alle anderen Empfänger.

Antworte NUR mit einem JSON-Array als letzte Zeile (kein Markdown, keine Backticks):
[{"timestamp":"15.03. 09:15","Cash":0,"Arms":0,"Cargo":0,"Metal":0,"Diamond":0}]

Regeln:
- Ein Objekt pro Bam-bamm-Eintrag
- Falls kein Zeitstempel lesbar: timestamp = ""
- Falls keine Bam-bamm-Einträge: []`;

  const response = await callClaude(base64, contentType, prompt);
  const text = response.content?.[0]?.text?.trim() ?? "";

  const arrayMatch = text.match(/\[[\s\S]*?\]/g);
  const objectMatch = text.match(/\{[^{}]*"Cash"[^{}]*\}/g);

  let parsed: Array<{
    timestamp: string;
    Cash: number; Arms: number; Cargo: number; Metal: number; Diamond: number;
  }> = [];

  if (arrayMatch) {
    try {
      const candidate = JSON.parse(arrayMatch[arrayMatch.length - 1]);
      if (Array.isArray(candidate)) {
        parsed = candidate.map((item) => ({
          timestamp: item.timestamp ?? "",
          Cash:    Number(item.Cash)    || 0,
          Arms:    Number(item.Arms)    || 0,
          Cargo:   Number(item.Cargo)   || 0,
          Metal:   Number(item.Metal)   || 0,
          Diamond: Number(item.Diamond) || 0,
        }));
      }
    } catch { /* weiter zum Fallback */ }
  }

  if (parsed.length === 0 && objectMatch) {
    try {
      const obj = JSON.parse(objectMatch[objectMatch.length - 1]);
      const hasAny = ["Cash","Arms","Cargo","Metal","Diamond"].some((k) => Number(obj[k]) > 0);
      if (hasAny) {
        parsed = [{
          timestamp: "",
          Cash:    Number(obj.Cash)    || 0,
          Arms:    Number(obj.Arms)    || 0,
          Cargo:   Number(obj.Cargo)   || 0,
          Metal:   Number(obj.Metal)   || 0,
          Diamond: Number(obj.Diamond) || 0,
        }];
      }
    } catch { /* leer lassen */ }
  }

  if (parsed.length === 0) {
    throw new Error("Kein JSON in Antwort: " + text.slice(0, 300));
  }

  return NextResponse.json({ result: parsed });
}

// ─────────────────────────────────────────────
// MODUS 2: Kampfbericht Übersichts-Screen
// ─────────────────────────────────────────────
async function handleBattleOverviewOcr(base64: string, contentType: string) {
  const prompt = `Du analysierst einen Übersichts-Screen eines Kampfberichts aus "The Grand Mafia".

AUFGABE 1 — Kampfdatum:
Lies das Datum und die Uhrzeit des Kampfes. Es steht meist oben rechts im Bild.
Format: "TT.MM.JJJJ HH:MM" oder ähnlich.

AUFGABE 2 — Seite:
Suche nach dem Kürzel "[1Ca]" im Bild.
- Steht "[1Ca]" auf der Angreifer-Seite (links oder "Attacker"): side = "attacker"
- Steht "[1Ca]" auf der Verteidiger-Seite (rechts oder "Defender"): side = "defender"
- Nicht erkennbar: side = "unknown"

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{"battle_date":"2026-03-15T14:30:00","side":"attacker"}

Regeln:
- battle_date im ISO-Format (JJJJ-MM-TTTHH:MM:00)
- Falls Datum nicht lesbar: battle_date = ""
- side: "attacker", "defender" oder "unknown"`;

  const response = await callClaude(base64, contentType, prompt);
  const text = response.content?.[0]?.text?.trim() ?? "";

  const match = text.match(/\{[^{}]*"battle_date"[^{}]*\}/);
  if (!match) throw new Error("Kein JSON in Antwort: " + text.slice(0, 300));

  const parsed = JSON.parse(match[0]);
  return NextResponse.json({
    battle_date: parsed.battle_date ?? "",
    side: parsed.side ?? "unknown",
  });
}

// ─────────────────────────────────────────────
// MODUS 3: Kampfbericht Detail-Screen
// ─────────────────────────────────────────────
async function handleBattleDetailOcr(base64: string, contentType: string) {
  const prompt = `Du analysierst einen Detail-Screen eines Kampfberichts aus "The Grand Mafia".

Das Bild zeigt Verluste einzelner Spieler. Für jeden Spieler gibt es einen Block mit:
- Dem Spielernamen (oben im Block, oft fett oder hervorgehoben)
- Mehreren Truppenzeilen darunter

IGNORIEREN — diese Elemente komplett überspringen:
- Held-Portraits (Charakterbilder mit Level-Anzeige)
- Fahrzeug-Karten (Autos mit Sternebewertung)
- Helikopter-Statistiken ("Dieser Helikopter nimmt/hat nicht am Kampf teil")
- Prozentzahlen wie "50,5%", Zahlen mit Münz-Icons

NUR AUSWERTEN — die "Einheiten"-Tabelle mit dieser Kopfzeile:
"Einheiten | Feinde töten | Überlebende | Verwundete | Tote"

→ wounded = der Wert in der Spalte "Verwundete" (vierte Spalte, rot)
→ "Feinde töten" (zweite Spalte, grün) — ignorieren
→ "Überlebende" (dritte Spalte, grün) — ignorieren
→ "Tote" (fünfte Spalte, rot) — ignorieren

TRUPPENART-ERKENNUNG (Icon ganz links in der Zeile):
- Messer/Dolch/Klinge (schmales spitzes Symbol) → "messer"
- Gewehr/Pistole (horizontales Waffen-Symbol) → "schuetzen"
- Motorrad (Zweirad-Symbol) → "biker"
- Auto/PKW (Fahrzeug mit 4 Rädern) → "autos"
WICHTIG: Messer sind die häufigste Truppenart — im Zweifel "messer" wählen, nicht "autos"

ZAHLENFORMAT: "12,5 K" = 12500, "1,2 M" = 1200000, "17.143" = 17143, "17,143" = 17143

FILTER:
- Nur Tier >= 4 übernehmen (T4, T5) — T1/T2/T3 komplett ignorieren
- Nur wounded > 0 übernehmen

Antworte NUR mit einem JSON-Array (kein Markdown, keine Backticks):
[{"ingame_name":"Spieler1","troop_type":"messer","tier":4,"wounded":17143}]

Regeln:
- Ein Objekt pro Spieler pro Truppenart pro Tier (nur T4+)
- ingame_name exakt wie im Bild geschrieben
- Falls keine T4+ Zeilen: []`;

  const response = await callClaude(base64, contentType, prompt);
  const text = response.content?.[0]?.text?.trim() ?? "";

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error("Kein JSON in Antwort: " + text.slice(0, 300));

  let parsed: Array<{
    ingame_name: string;
    troop_type: string;
    tier: number;
    wounded: number;
  }> = [];

  try {
    const raw = JSON.parse(arrayMatch[0]);
    if (Array.isArray(raw)) {
      parsed = raw
        .filter((item) => item.tier >= 4 && item.wounded > 0)
        .map((item) => ({
          ingame_name: String(item.ingame_name ?? "").trim(),
          troop_type:  String(item.troop_type ?? "").toLowerCase().trim(),
          tier:        Number(item.tier),
          wounded:     Number(item.wounded),
        }))
        .filter((item) =>
          item.ingame_name.length > 0 &&
          ["messer", "schuetzen", "biker", "autos"].includes(item.troop_type)
        );
    }
  } catch (e) {
    throw new Error("JSON-Parse-Fehler: " + text.slice(0, 300));
  }

  console.log('battle_detail OCR result:', JSON.stringify(parsed));

  return NextResponse.json({ casualties: parsed });
}

// ─────────────────────────────────────────────
// MODUS 4: FCU Rangliste
// ─────────────────────────────────────────────
async function handleFcuOcr(base64: string, contentType: string) {
  const prompt = `Du analysierst einen Screenshot einer FCU-Rangliste aus "The Grand Mafia".

Das Bild zeigt eine Tabelle mit Rängen, Spielernamen und Punktzahlen.

AUFGABE:
Lies alle sichtbaren Zeilen der Rangliste aus.

SPIELERNAME-BEREINIGUNG:
- Entferne Präfixe wie "#171", "[1Ca]", Clan-Tags in eckigen Klammern
- Behalte nur den reinen Spielernamen

ZAHLENFORMAT:
- "2.753" = 2753 (Tausenderpunkt entfernen)
- "1.234.567" = 1234567

IGNORIEREN:
- Spalte "Annehmen" oder ähnliche Action-Spalten
- Kopfzeile der Tabelle

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{"results":[{"rank":1,"ingame_name":"Spielername","points":12345}]}

Regeln:
- rank = Platznummer (Zahl)
- ingame_name = bereinigter Spielername
- points = Punktzahl als ganze Zahl
- Falls keine Zeilen erkennbar: {"results":[]}`;

  const response = await callClaude(base64, contentType, prompt);
  const text = response.content?.[0]?.text?.trim() ?? "";

  const match = text.match(/\{[\s\S]*"results"[\s\S]*\}/);
  if (!match) throw new Error("Kein JSON in Antwort: " + text.slice(0, 300));

  let parsed: Array<{ rank: number; ingame_name: string; points: number }> = [];
  try {
    const raw = JSON.parse(match[0]);
    parsed = (raw.results ?? []).map((item: { rank: unknown; ingame_name: unknown; points: unknown }) => ({
      rank:        Number(item.rank),
      ingame_name: String(item.ingame_name ?? "").trim(),
      points:      Number(item.points) || 0,
    })).filter((item: { ingame_name: string }) => item.ingame_name.length > 0);
  } catch {
    throw new Error("JSON-Parse-Fehler: " + text.slice(0, 300));
  }

  return NextResponse.json({ results: parsed });
}

// ─────────────────────────────────────────────
// Gemeinsame Claude-Haiku Hilfsfunktion
// ─────────────────────────────────────────────
async function callClaude(base64: string, contentType: string, prompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: contentType, data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("Anthropic API Fehler: " + err);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, mode } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Keine imageUrl" }, { status: 400 });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Bild konnte nicht geladen werden");
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";

    if (mode === "battle_overview") {
      return await handleBattleOverviewOcr(base64, contentType);
    }
    if (mode === "battle_detail") {
      return await handleBattleDetailOcr(base64, contentType);
    }
    if (mode === "fcu") {
      return await handleFcuOcr(base64, contentType);
    }

    return await handleDepositOcr(base64, contentType);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
