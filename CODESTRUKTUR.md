# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 20.03.2026 | Fahrplan V21
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
│   │   └── page.tsx              ← Haupt-App nach Login
│   ├── login/
│   │   └── page.tsx              ← Login-Seite
│   ├── register/
│   │   └── page.tsx              ← 4-Schritt-Registrierung
│   ├── globals.css               ← @import "tailwindcss" (Tailwind v4, keine tailwind.config.ts)
│   └── layout.tsx
├── components/
│   ├── AdminPanel.tsx
│   ├── ApprovalQueue.tsx
│   ├── BacklogWidget.tsx
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── HelpButton.tsx
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
- **Props:**
  - `lang: Lang`
  - `clanId: string`
  - `onUploadComplete: (url: string, hash: string | null) => void`
  - `maxAgeDays?: number` ← Default: **4** (Einzahlungen), BattleReport: **7**
- **Key-Functions:** `isFileTooOld(file)`, SHA-256 via `crypto.subtle`, Upload zu Supabase Storage Bucket `screenshots`
- **Hinweis:** Für Kampfberichte immer `maxAgeDays={7}` übergeben

---

### `BattleReportUpload.tsx`
- **Props:**
  - `lang: Lang`
  - `onComplete?: (battleReportId: string) => void`
- **Key-States:** `overviewUrl`, `overviewHash`, `detailSlots: ScreenSlot[6]`, `battleDate`, `selectedSide`
- **Key-Functions:**
  - `handleMultiFileSelect()` — Multi-File-Input für alle 6 Detail-Slots auf einmal (useRef)
  - `isFileTooOld(file)` — `MAX_SCREEN_AGE_DAYS = 7`
  - `handleCreateReport()` — Pflichtfeld-Validierung: battleDate muss gesetzt sein
- **OCR-Modi:** `battle_overview` (Übersichts-Screen) / `battle_detail` (Detail-Screen)
- **Kampfdatum:** Pflichtfeld mit orangenem Rahmen wenn leer, KW-Badge erscheint sofort nach Eingabe

---

### `DepositsTab.tsx`
- **Props:** `lang: Lang`
- **Key-Functions:** Bulk-Einzahlung, `isManualMode`-Flag (Default: false → auto-approved), Inline-Edit
- **RPC:** `create_bulk_deposit`

---

### `ApprovalQueue.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `offizier` und `admin`
- **Key-Function:** Genehmigt/ablehnt Einzahlungen mit `input_manual = true`

---

### `RankingTab.tsx`
- **Props:** `lang: Lang`
- **Key-Functions:** Brutto/Netto-Toggle, KW-basierter Schwellenwert `(combat_kw - 2) × 5M`
- **RPC:** `get_ranking_data(p_clan_id)`
- **Hinweis:** Raidleiter (`is_raidleiter = true`) werden NICHT im Ranking angezeigt

---

### `BacklogWidget.tsx`
- **Props:** `lang: Lang`
- **Key-Function:** Ampelfarben für Rückstand, Raidleiter ausgeblendet

---

### `PayoutCalculation.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier` (Raidleiter können nur lesen)
- **Key-Functions:**
  - Auszahlungsberechnung: proportional, Raidleiter × 2
  - `calculate_payouts(p_battle_report_id)`
  - `mark_payout_paid(p_battle_report_id)`

---

### `SecurityAlerts.tsx`
- **Props:** `lang: Lang`
- **Dashboard-Tab:** "Warnungen" mit rotem Badge-Indikator
- **Gespeist von:** `security_alerts`-Tabelle

---

### `StarterMembersPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **Key-Functions:** CSV-Import, Claim-Verwaltung (confirm/reject)

---

### `SuggestionBox.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin/Offizier sehen Antwort-Funktion)

---

### `AdminPanel.tsx`
- **Props:** `lang: Lang`
- **Key-Sektionen:** Mitgliederverwaltung, Raidleiter-Flag, Starter-Members, Clan-Code MAFIA2026 (immer sichtbar)

---

### `WelcomeModal.tsx` / `HelpButton.tsx`
- **Props:** `lang: Lang`, `onClose: () => void` (WelcomeModal)

---

## 3. API-Routen

### `app/api/ocr/route.ts`
- **Methode:** POST
- **Model:** `claude-haiku-4-5-20251001` ← GENAU so, nicht `claude-haiku-4-5`
- **max_tokens:** 1024
- **Modi (im Request-Body `mode`):**

| Mode | Beschreibung |
|------|-------------|
| `deposit` | Einzahlungs-Screenshot — 5 Ressourcen (Slot 1-5), filtert "sind von", Ziel "Bam bamm" |
| `battle_overview` | Kampfbericht Übersicht — Datum, KW, Seite, Spielerliste |
| `battle_detail` | Kampfbericht Detail — Verwundete per Spaltenname-Anker, Truppenart (Default: Messer), Hero-Block ignorieren |

- **Slot-Positionen (deposit-Mode):** Slot 1=Cash, Slot 2=Arms, Slot 3=Cargo, Slot 4=Metal (2. von rechts), Slot 5=Diamond (ganz rechts)
- **Bekannte Einschränkung:** Cargo auf Desktop-Screenshots < 600px Breite gelegentlich nicht erkannt

---

## 4. Datenbank

### Tabellen

#### `clans`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | `00000000-0000-0000-0000-000000000001` für Camorra Elite |
| name | text | "Camorra Elite" |
| invite_code | text | "MAFIA2026" (immer sichtbar in AdminPanel) |

#### `profiles`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | = auth.uid() |
| clan_id | uuid FK | → clans.id |
| ingame_name | text | Ingame-Name (Matching für Idee 2/3) |
| display_name | text | Anzeigename |
| role | enum | `admin` / `offizier` / `mitglied` |
| is_raidleiter | boolean | Flag (nicht Rolle), Admin+Offizier können setzen |
| deleted_at | timestamptz | Soft-Delete |

#### `deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| user_id | uuid FK | → profiles.id |
| clan_id | uuid FK | → clans.id |
| resource_type | text | cash / arms / cargo / metal / diamond |
| amount | bigint | |
| status | enum | `pending` / `approved` / `rejected` |
| screenshot_url | text | Supabase Storage URL |
| screenshot_hash | text | SHA-256, Duplikatschutz |
| input_manual | boolean | true → pending (Offizier-Prüfung nötig) |
| deleted_at | timestamptz | Soft-Delete |

#### `starter_members`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| ingame_name | text | aus CSV-Import |
| display_name | text | |
| role | enum | mitglied / offizier / admin |
| status | enum | `unclaimed` / `claimed` / `confirmed` / `rejected` |
| claimed_by | uuid | → profiles.id |

#### `suggestions`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| user_id | uuid FK | |
| title | text | |
| content | text | |
| status | enum | `open` / `in_progress` / `done` / `rejected` |
| response | text | Antwort von Admin/Offizier |

#### `security_alerts`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| user_id | uuid FK | |
| alert_type | text | z.B. "duplicate_hash" |
| details | jsonb | |

#### `battle_reports`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| created_by | uuid FK | → profiles.id (Raidleiter) |
| battle_date | date | Pflichtfeld |
| battle_kw | int | Kalenderwoche, aus Datum berechnet |
| status | enum | `draft` / `ocr_done` / `calculated` / `paid` |
| overview_url | text | Übersichts-Screenshot URL |
| overview_hash | text | SHA-256 |

#### `battle_report_screens`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| battle_report_id | uuid FK | |
| slot_index | int | 0–5 (6 Slots im 2×3 Grid) |
| url | text | |
| hash | text | SHA-256 |

#### `battle_casualties`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| battle_report_id | uuid FK | |
| ingame_name | text | aus OCR |
| troop_type | text | messer / schuetzen / biker / autos |
| tier | int | T4+ zählt für Auszahlung |
| wounded_count | int | Verwundete (nicht Tote) |

#### `payouts`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| battle_report_id | uuid FK | |
| user_id | uuid FK | → profiles.id |
| resource_type | text | cash / arms / cargo / metal / diamond |
| amount | bigint | |
| status | enum | `pending` / `paid` |

#### `member_exemptions`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| user_id | uuid FK | |
| clan_id | uuid FK | |
| reason | text | |

#### `audit_log`
- Automatisch befüllt via `fn_audit_log` Trigger — alle Status-Änderungen

### Views
- **`active_deposits`** — filtert approved + nicht-deleted Deposits

### Supabase Storage
- **Bucket:** `screenshots` — alle Upload-URLs (Einzahlungen + Kampfberichte)

---

## 5. RPCs (Supabase Functions)

> Alle RPCs: `SET search_path = public` und `SECURITY DEFINER` wo nötig
> Alle RPCs geben zurück: `{ success: boolean, message: string }`

### Hilfs-Funktionen (SECURITY DEFINER)
```sql
get_my_clan_id() → uuid
get_my_role()    → text   -- 'admin' | 'offizier' | 'mitglied'
```

### Einzahlungen
```sql
create_bulk_deposit(
  p_clan_id  uuid,
  p_deposits jsonb   -- [{resource_type, amount, screenshot_url, screenshot_hash, input_manual}]
) → { success, message }

check_screenshot_hash(
  p_hash    text,
  p_clan_id uuid
) → { exists: boolean }
```

### Ranking
```sql
get_ranking_data(p_clan_id uuid) → TABLE(user_id, ingame_name, resource_type, total_amount, ...)
```

### Starter-Mitglieder
```sql
import_starter_members(p_members jsonb) → { success, message }
claim_starter_profile(p_starter_id uuid) → { success, message }
confirm_starter_claim(p_starter_id uuid) → { success, message }   -- Admin/Offizier
reject_starter_claim(p_starter_id uuid)  → { success, message }   -- Admin/Offizier
```

### Vorschläge
```sql
create_suggestion(p_title text, p_content text)                           → { success, message }
respond_to_suggestion(p_suggestion_id uuid, p_response text, p_status text) → { success, message }
```

### Kampfberichte & Auszahlungen
```sql
create_battle_report(
  p_clan_id       uuid,
  p_battle_date   date,
  p_overview_url  text,
  p_overview_hash text
) → { success, message, battle_report_id: uuid }

save_battle_casualties(
  p_battle_report_id uuid,
  p_casualties jsonb  -- [{ingame_name, troop_type, tier, wounded_count}]
) → { success, message }

calculate_payouts(p_battle_report_id uuid) → { success, message }
-- Formel: 2.4M / 10k T4+ Verwundete (Standard), 1.2M für Diamond
-- Raidleiter: × 2 auf alle Ressourcen
-- Berechtigung: ≥10k T4+ Verwundete + (combat_kw - 2) × 5M Deposits (≥3/5 Ressourcen)

mark_payout_paid(p_battle_report_id uuid) → { success, message }
```

---

## 6. Key-Patterns

### Imports (niemals anders)
```typescript
import { supabase } from '@/lib/supabaseClient'  // ← NICHT aus useAuth()
import { useAuth } from '@/lib/auth-context'

// useAuth liefert:
const { user, profile, loading, signOut } = useAuth()
// profile.role, profile.clan_id, profile.ingame_name, profile.is_raidleiter
```

### Supabase RPC aufrufen
```typescript
const { data, error } = await supabase.rpc('rpc_name', { p_param: value })
// Rückgabe prüfen:
if (error || !data?.success) {
  setFeedback(data?.message || 'Fehler')
  return
}
```

### Supabase FK-Join (Ambiguität vermeiden)
```typescript
// FALSCH wenn deposits mehrere FKs auf profiles hat:
supabase.from('deposits').select('*, profiles(ingame_name)')
// RICHTIG — expliziter FK-Hint:
supabase.from('deposits').select('*, profiles!deposits_user_id_fkey(ingame_name)')
```

### Profile-Namen für Offiziere/Admins laden (RLS-Problem umgehen)
```typescript
// NICHT als Join — stattdessen separate Query:
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, ingame_name')
  .in('id', userIds)
```

### SHA-256 im Browser
```typescript
const buf = await file.arrayBuffer()
const digest = await crypto.subtle.digest('SHA-256', buf)
const hash = Array.from(new Uint8Array(digest))
  .map(b => b.toString(16).padStart(2, '0')).join('')
```

### Altersvalidierung (Screenshots)
```typescript
const MAX_AGE_DAYS = 4  // oder 7 für Kampfberichte
function isFileTooOld(file: File): boolean {
  const ageMs = Date.now() - file.lastModified
  return ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}
```

### InfoTooltip (NICHT in label einbetten)
```tsx
// ✅ Richtig:
<div className="flex items-center gap-1">
  <label htmlFor="field-id">Feldname</label>
  <InfoTooltip content="..." lang={lang} />
</div>

// ❌ Falsch (triggert Label-Click):
<label>Feldname <InfoTooltip .../></label>
```

### Template Literals in JSX (Turbopack-Problem)
```typescript
// ❌ Kann Turbopack-Parse-Fehler verursachen:
const text = `Hallo ${name}, du hast ${count} Einzahlungen`

// ✅ Stattdessen String-Konkatenation:
const text = 'Hallo ' + name + ', du hast ' + count + ' Einzahlungen'
```

### Variable Shadowing vermeiden
```typescript
// ❌ Wenn 'error' bereits im Scope ist:
const { error } = await supabase.rpc(...)

// ✅ Umbenennen:
const { error: rpcError } = await supabase.rpc(...)
```

### Datei-Editierung (Faustregel)
- **< ~300 Zeilen** → vollständige Datei liefern
- **> ~300 Zeilen** → `str_replace`-Paare (search/replace), eine Datei nach der anderen

### Kein lucide-react
```typescript
// ❌ import { AlertCircle } from 'lucide-react'  — nicht installiert
// ✅ Emoji oder inline SVG verwenden: ⚠️ ✅ ❌ 💡
```

---

## 7. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------|
| Einzahlungen sehen | ✅ alle | ✅ alle | ✅ eigene |
| Einzahlungen genehmigen | ✅ | ✅ | ❌ |
| Raidleiter-Flag setzen | ✅ | ✅ (nicht sich selbst) | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |
| Vorschläge antworten | ✅ | ✅ | ❌ |
| Kampfbericht hochladen | ✅ | ✅ | ❌ |
| Auszahlung berechnen | ✅ | ✅ | ❌ |

**Auth-Pattern:**
- Fake-Email: `username@clanbank.local`
- Clan-Einladungscode: `MAFIA2026`
- Demo-Code (geplant): `DEMO2026` (7-Tage-Ablauf)
- Supabase-ID Camorra Elite: `00000000-0000-0000-0000-000000000001`

---

## 8. Bekannte Fallstricke (aus vergangenen Sessions)

| Problem | Lösung |
|---------|--------|
| `search_path`-Fehler bei RPCs | `SET search_path = public` in jede RPC-Definition |
| Enum-Änderung mit View-Abhängigkeit | View droppen → Enum ändern → View neu erstellen |
| Supabase FK-Join-Ambiguität | `profiles!deposits_user_id_fkey(...)` explizit angeben |
| Vercel build-Fehler nach Edit | Raw-GitHub-URL prüfen: `https://raw.githubusercontent.com/zynador/clanbank-web/main/[Pfad]` |
| Mehrere Tabs im GitHub-Editor | Können sich gegenseitig überschreiben — immer nur ein Tab |
| `get_my_role()` lässt sich nicht droppen | `CASCADE` oder alle abhängigen Policies zuerst droppen |
| OCR-Modell-String falsch | Muss exakt `claude-haiku-4-5-20251001` sein |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
