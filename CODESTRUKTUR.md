# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 20.03.2026 | Fahrplan V22
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)
```
clanbank-web/
├── app/
│   ├── api/
│   │   └── ocr/
│   │       └── route.ts          ← Claude Haiku Vision OCR (alle Modi)
│   ├── dashboard/
│   │   └── page.tsx              ← Haupt-App nach Login (Hamburger Drawer)
│   ├── login/
│   │   └── page.tsx              ← Login-Seite
│   ├── register/
│   │   └── page.tsx              ← 4-Schritt-Registrierung
│   ├── globals.css               ← @import "tailwindcss" (Tailwind v4, keine tailwind.config.ts)
│   └── layout.tsx
├── components/
│   ├── AdminPanel.tsx
│   ├── AnnouncementWidget.tsx    ← Admin-Ankündigungen (erstellen/löschen/anpinnen)
│   ├── ApprovalQueue.tsx
│   ├── BacklogWidget.tsx
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── FCUEventTab.tsx           ← FCU Haupt-Container (Event-Liste, Navigation)
│   ├── FCUResultsEditor.tsx      ← OCR-Ergebnisse prüfen, Namen korrigieren, speichern
│   ├── FCURankingView.tsx        ← Gesamtranking über alle FCU Events
│   ├── FCUUploadPanel.tsx        ← Multi-Screenshot Upload + OCR pro Screen
│   ├── HelpButton.tsx
│   ├── HomeTab.tsx               ← Neue Startseite (Status, Backlog, Ankündigungen, Schnellzugriff)
│   ├── InfoTooltip.tsx
│   ├── Logo.tsx                  ← KEINE Props
│   ├── PayoutCalculation.tsx
│   ├── RankingTab.tsx
│   ├── ScreenshotThumb.tsx
│   ├── ScreenshotUpload.tsx
│   ├── SecurityAlerts.tsx
│   ├── StarterMembersPanel.tsx
│   ├── SuggestionBox.tsx
│   └── WelcomeModal.tsx
├── lib/
│   ├── auth-context.tsx          ← useAuth() Hook
│   └── supabaseClient.ts         ← supabase Client (IMMER von hier importieren)
└── CODESTRUKTUR.md               ← diese Datei
```

---

## 2. Komponenten

### Pflicht-Imports (immer so, nie anders)
```typescript
import { supabase } from '@/lib/supabaseClient'   // NICHT aus useAuth() destructuren
import { useAuth } from '@/lib/auth-context'
```

### Typ-Definitionen (global)
```typescript
type Lang = 'de' | 'en'
type UserRole = 'admin' | 'offizier' | 'mitglied'
```

---

### `Logo.tsx`
- **Props:** keine
- **Hinweis:** Immer ohne Props aufrufen: `<Logo />`

---

### `HomeTab.tsx`
- **Props:** `lang: Lang`, `onNavigate: (tab: string) => void`
- **Key-Sections:**
  - Persönlicher Clanbank-Status (grün/rot) mit fehlenden Ressourcen als Pills
  - Wand der Schande (Admin + Offizier): Mitglied + KW-Rückstand + Ressourcen-Emojis
  - `AnnouncementWidget` eingebettet
  - Stats-Kacheln: letzter FCU-Rang + Clan-Einzahlungsquote
  - Schnellzugriff auf alle 4 Hauptbereiche via `onNavigate`
- **Backlog-Logik:** ISO-Kalenderwochen, keine externen Abhängigkeiten

---

### `AnnouncementWidget.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin sieht Formular + Löschen-Button)
- **Key-Functions:** `create_announcement` RPC, `delete_announcement` RPC
- **Anzeige:** max. 5 Einträge, angepinnte zuerst, relative Zeitanzeige

---

### `FCUEventTab.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin kann anlegen/hochladen)
- **Key-States:** `view: 'list' | 'upload' | 'results' | 'ranking'`, `activeEventId`
- **Sub-Views:** lazy-loaded via `require()` (FCUUploadPanel, FCUResultsEditor, FCURankingView)
- **RPC:** `create_fcu_event`

---

### `FCUUploadPanel.tsx`
- **Props:** `lang: Lang`, `eventId: string`, `onBack: () => void`, `onDone: () => void`
- **Nur sichtbar für:** Admin
- **Key-Functions:**
  - Dynamische Slots (beliebig viele Screenshots)
  - SHA-256 → Upload zu Storage (`fcu/<eventId>/<slotId>_<hash>.<ext>`)
  - OCR Modus `fcu` pro Screenshot
  - OCR-Ergebnisse in `sessionStorage` mergen (Key: `fcu_ocr_<eventId>`)
  - Screen-URL in `fcu_event_screens` speichern

---

### `FCUResultsEditor.tsx`
- **Props:** `lang: Lang`, `eventId: string`, `onBack: () => void`
- **Key-Functions:**
  - Lädt DB-Ergebnisse (falls vorhanden) sonst `sessionStorage`
  - Admin bei `draft`: Namen + Punkte inline editierbar
  - Profilmatch-Indikator (✓ / –)
  - `save_fcu_results` RPC → Namensabgleich serverseitig
  - `sessionStorage` nach Speichern geleert

---

### `FCURankingView.tsx`
- **Props:** `lang: Lang`, `onBack: () => void`
- **Key-Functions:** `get_fcu_overall_ranking` RPC, Top-3 Podest, eigener Rang hervorgehoben
- **Sortierung:** niedrigste Rang-Summe = Platz 1

---

### `InfoTooltip.tsx`
- **Props:** `content: string`, `lang?: Lang`
- **Wichtig:** NICHT in `<label>`-Tag einbetten — immer als Geschwister neben `<label htmlFor="...">`:
```tsx
<div className="flex items-center gap-1">
  <label htmlFor="field-id">Feldname</label>
  <InfoTooltip content="Erklärung" lang={lang} />
</div>
```

---

### `ScreenshotUpload.tsx`
- **Props:** `lang: Lang`, `clanId: string`, `onUploadComplete: (url: string, hash: string | null) => void`, `maxAgeDays?: number`
- **Default maxAgeDays:** 4 (Einzahlungen), BattleReport: 7
- **Hinweis:** Für FCU kein Alterscheck — `FCUUploadPanel` hat eigene Upload-Logik

---

### `BattleReportUpload.tsx`
- **Props:** `lang: Lang`, `onComplete?: (battleReportId: string) => void`
- **Key-States:** `overviewUrl`, `overviewHash`, `detailSlots: ScreenSlot[6]`, `battleDate`, `selectedSide`
- **OCR-Modi:** `battle_overview` / `battle_detail`

---

### `DepositsTab.tsx`
- **Props:** `lang: Lang`
- **RPC:** `create_bulk_deposit`

---

### `ApprovalQueue.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `offizier` und `admin`

---

### `RankingTab.tsx`
- **Props:** `lang: Lang`
- **RPC:** `get_ranking_data(p_clan_id)`
- **Hinweis:** Raidleiter (`is_raidleiter = true`) werden NICHT im Ranking angezeigt

---

### `BacklogWidget.tsx`
- **Props:** `lang: Lang`
- **Hinweis:** Wird in HomeTab ersetzt — kann für separate Ansichten noch genutzt werden

---

### `PayoutCalculation.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier`

---

### `SecurityAlerts.tsx`
- **Props:** `lang: Lang`

---

### `StarterMembersPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`

---

### `SuggestionBox.tsx`
- **Props:** `lang: Lang`

---

### `AdminPanel.tsx`
- **Props:** `lang: Lang`

---

### `WelcomeModal.tsx` / `HelpButton.tsx`
- **Props:** `lang: Lang`, `onClose: () => void` (WelcomeModal)

---

## 3. API-Routen

### `app/api/ocr/route.ts`
- **Methode:** POST
- **Model:** `claude-haiku-4-5-20251001`
- **max_tokens:** 2048
- **Modi:**

| Mode | Beschreibung |
|------|-------------|
| `deposit` | Einzahlungs-Screenshot — 5 Ressourcen, filtert "Bam bamm" |
| `battle_overview` | Kampfbericht Übersicht — Datum, Seite |
| `battle_detail` | Kampfbericht Detail — Verwundete T4+ |
| `fcu` | FCU-Rangliste — Rang, Name (ohne Präfix), Punkte (ohne Tausenderpunkt) |

- **FCU-Besonderheiten:**
  - Präfix `#171 [1Ca]` wird im Prompt gestrippt
  - Tausenderpunkte: `"2.753"` → `2753`
  - Spalte 4 "Annehmen" wird ignoriert
  - Rückgabe: `{ results: [{rank, ingame_name, points}] }`

---

## 4. Datenbank

### Tabellen (neu seit V22)

#### `fcu_events`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | → clans.id |
| created_by | uuid FK | → profiles.id |
| event_name | text | z.B. "FCU März 2026" |
| event_date | date | |
| status | text | `draft` / `confirmed` |

#### `fcu_event_screens`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| fcu_event_id | uuid FK | ON DELETE CASCADE |
| slot_index | int | 0-basiert |
| url | text | Supabase Storage URL |
| hash | text | SHA-256 |

#### `fcu_results`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| fcu_event_id | uuid FK | ON DELETE CASCADE |
| clan_id | uuid FK | |
| rank | int | |
| ingame_name | text | vollständiger Name (nach Abgleich) |
| points | bigint | |
| profile_id | uuid | nullable, auto-match |

#### `announcements`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| created_by | uuid FK | |
| title | text | |
| content | text | nullable |
| pinned | boolean | Default: false |

### Bestehende Tabellen
→ Siehe V21 (clans, profiles, deposits, battle_reports, battle_report_screens, battle_casualties, payouts, member_exemptions, starter_members, suggestions, security_alerts, audit_log)

---

## 5. RPCs

### Neu seit V22
```sql
create_fcu_event(p_clan_id, p_event_name, p_event_date)
  → { success, message, fcu_event_id }

save_fcu_results(p_fcu_event_id, p_results jsonb)
  → { success, message }
  -- p_results: [{rank, ingame_name, points}]
  -- Macht Namensabgleich: exakt → ILIKE prefix%
  -- Setzt Event-Status auf 'confirmed'

get_fcu_overall_ranking(p_clan_id)
  → TABLE(ingame_name, profile_id, event_count, rank_sum, avg_rank, best_rank)
  -- Nur confirmed Events, sortiert nach rank_sum ASC

create_announcement(p_clan_id, p_title, p_content, p_pinned)
  → { success, message }

delete_announcement(p_announcement_id)
  → { success, message }
```

### Bestehende RPCs
→ Siehe V21 (create_bulk_deposit, check_screenshot_hash, get_ranking_data, import_starter_members, claim_starter_profile, confirm_starter_claim, reject_starter_claim, create_suggestion, respond_to_suggestion, create_battle_report, save_battle_casualties, calculate_payouts, mark_payout_paid)

---

## 6. Navigation (Hamburger Drawer)

`dashboard/page.tsx` verwendet einen Hamburger Drawer statt Top-Tabs.

### Tab-Typen
```typescript
type Tab =
  | 'home'        // HomeTab (Standard)
  | 'deposits'    // DepositsTab
  | 'battle'      // BattleReportUpload + PayoutCalculation
  | 'ranking'     // RankingTab
  | 'fcu'         // FCUEventTab
  | 'freigabe'    // ApprovalQueue (offizier + admin)
  | 'vorschlaege' // SuggestionBox
  | 'warnungen'   // SecurityAlerts (offizier + admin)
  | 'verwaltung'  // AdminPanel (admin)
```

### Navigation aus Komponenten
```typescript
// HomeTab Schnellzugriff:
onNavigate('deposits')   // → Bank
onNavigate('battle')     // → Kampfberichte
onNavigate('ranking')    // → Ranking
onNavigate('fcu')        // → FCU
```

---

## 7. Key-Patterns

→ Siehe V21 (Imports, RPC-Aufrufe, FK-Joins, SHA-256, Altersvalidierung, InfoTooltip, Template Literals, Variable Shadowing)

### FCU sessionStorage Pattern
```typescript
// FCUUploadPanel schreibt:
const key = 'fcu_ocr_' + eventId
sessionStorage.setItem(key, JSON.stringify(mergedRows))

// FCUResultsEditor liest:
const stored = sessionStorage.getItem('fcu_ocr_' + eventId)

// Nach Speichern aufräumen:
sessionStorage.removeItem('fcu_ocr_' + eventId)
```

### FCU Sub-View lazy loading
```typescript
// In FCUEventTab — verhindert zirkuläre Imports:
const FCUUploadPanel = require('./FCUUploadPanel').default
const FCUResultsEditor = require('./FCUResultsEditor').default
const FCURankingView = require('./FCURankingView').default
```

---

## 8. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------|
| FCU Event anlegen | ✅ | ❌ | ❌ |
| FCU Screenshots hochladen | ✅ | ❌ | ❌ |
| FCU Ergebnisse bearbeiten | ✅ | ❌ | ❌ |
| FCU Ergebnisse lesen | ✅ | ✅ | ✅ (confirmed) |
| Ankündigungen erstellen | ✅ | ❌ | ❌ |
| Wand der Schande sehen | ✅ | ✅ | ❌ |

---

## 9. Bekannte Fallstricke

→ Alle aus V21 weiterhin gültig, zusätzlich:

| Problem | Lösung |
|---------|--------|
| FCU-Namen mit Sonderzeichen ohne Match | Bleiben als OCR-Name — Admin korrigiert manuell in FCUResultsEditor |
| sessionStorage leer nach Seitenreload | FCUResultsEditor fällt auf DB-Ergebnisse zurück |
| Tausenderpunkte in FCU-Punkten | OCR-Prompt konvertiert explizit: `"2.753"` → `2753` |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
