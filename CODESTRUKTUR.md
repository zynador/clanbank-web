# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 22.03.2026 | Fahrplan V26
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)

```
clanbank-web/
├── .github/
│   └── workflows/
│       └── playwright.yml        ← GitHub Actions E2E-Tests (bei jedem Push auf main)
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
│   ├── HomeTab.tsx               ← Startseite (Status, Backlog, Ankündigungen, Schnellzugriff)
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
├── tests/                        ← Playwright E2E-Tests (von tsconfig ausgeschlossen)
│   ├── playwright.config.ts
│   ├── auth.spec.ts
│   ├── navigation.spec.ts
│   ├── home.spec.ts
│   ├── fcu.spec.ts
│   └── announcements.spec.ts
├── tsconfig.json                 ← exclude: ["node_modules", "tests"]
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
  - Wand der Schande (Admin + Offizier): Grid-Layout mit kompakten Mitgliederkarten (2–5 nebeneinander)
  - Klick auf Karte → Detail-Panel mit Gesamteinzahlungen + Ressourcen-Balken (lazy loaded)
  - `AnnouncementWidget` eingebettet
  - Stats-Kacheln: letzter FCU-Rang + Clan-Einzahlungsquote
  - Schnellzugriff auf alle 4 Hauptbereiche via `onNavigate`
- **Backlog-Logik:** ISO-Kalenderwochen, keine externen Abhängigkeiten
- **Filter:** Raidleiter (`is_raidleiter = true`) und Testaccounts (`is_test = true`) werden clientseitig herausgefiltert
- **Raidleiter-Status:** `loadMyStatus()` prüft `is_raidleiter` zuerst → setzt sofort auf "auf dem Laufenden"

---

### `AnnouncementWidget.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin sieht Formular + Löschen-Button)
- **Key-Functions:** `create_announcement` RPC, `delete_announcement` RPC
- **Anzeige:** max. 5 Einträge, angepinnte zuerst, relative Zeitanzeige
- **Formular:** kein `<form>`-Tag — Submit via `onClick={handleSave}` auf Button "Veröffentlichen"

---

### `FCUEventTab.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (nur Admin kann anlegen/hochladen)
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

---

### `BattleReportUpload.tsx`
- **Props:** `lang: Lang`, `onComplete?: (battleReportId: string) => void`
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
- **Sichtbar für:** `admin` und `offizier`
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
- **Schließen-Button:** `aria-label="Schließen"` ← wichtig für Playwright-Tests

---

## 3. API-Routen

### `app/api/ocr/route.ts`
- **Model:** `claude-haiku-4-5-20251001` ← GENAU so, nicht `claude-haiku-4-5`
- **max_tokens:** 2048

| Mode | Beschreibung |
|------|-------------|
| `deposit` | Einzahlungs-Screenshot — 5 Ressourcen, filtert "Bam bamm" |
| `battle_overview` | Kampfbericht Übersicht — Datum, Seite |
| `battle_detail` | Kampfbericht Detail — Verwundete T4+, Hero-Block ignorieren |
| `fcu` | FCU-Rangliste — Rang, Name (ohne Präfix), Punkte (ohne Tausenderpunkt) |

- **FCU-Besonderheiten:**
  - Präfix `#171 [1Ca]` wird gestrippt
  - `"2.753"` → `2753`
  - Spalte 4 "Annehmen" ignorieren
  - Rückgabe: `{ results: [{rank, ingame_name, points}] }`
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
| is_test | boolean | Testaccounts (Playwright) — aus allen UI-Listen gefiltert |
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

#### `fcu_events`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| created_by | uuid FK | |
| event_name | text | |
| event_date | date | |
| status | text | `draft` / `confirmed` |

#### `fcu_event_screens`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| fcu_event_id | uuid FK | ON DELETE CASCADE |
| slot_index | int | 0-basiert |
| url | text | |
| hash | text | SHA-256 |

#### `fcu_results`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| fcu_event_id | uuid FK | ON DELETE CASCADE |
| clan_id | uuid FK | |
| rank | int | |
| ingame_name | text | vollständiger Name nach Abgleich |
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

#### Weitere Tabellen (unverändert seit V21)
`starter_members`, `suggestions`, `security_alerts`, `battle_reports`, `battle_report_screens`, `battle_casualties`, `payouts`, `member_exemptions`, `audit_log`

### Views
- **`active_deposits`** — filtert approved + nicht-deleted Deposits

### Supabase Storage
- **Bucket:** `screenshots` — Einzahlungen + Kampfberichte + FCU

---

## 5. RPCs

### Hilfs-Funktionen
```sql
get_my_clan_id() → uuid
get_my_role()    → text
```

### FCU (neu seit V24)
```sql
create_fcu_event(p_clan_id, p_event_name, p_event_date)
  → { success, message, fcu_event_id }

save_fcu_results(p_fcu_event_id, p_results jsonb)
  → { success, message }
  -- Namensabgleich: exakt → ILIKE prefix%
  -- Setzt status auf 'confirmed'

get_fcu_overall_ranking(p_clan_id)
  → TABLE(ingame_name, profile_id, event_count, rank_sum, avg_rank, best_rank)

create_announcement(p_clan_id, p_title, p_content, p_pinned)
  → { success, message }

delete_announcement(p_announcement_id)
  → { success, message }
```

### Einzahlungen
```sql
create_bulk_deposit(p_clan_id, p_deposits jsonb) → { success, message }
check_screenshot_hash(p_hash, p_clan_id) → { exists: boolean }
```

### Ranking
```sql
get_ranking_data(p_clan_id uuid) → TABLE(...)
```

### Starter-Mitglieder
```sql
import_starter_members(p_members jsonb) → { success, message }
claim_starter_profile(p_starter_id uuid) → { success, message }
confirm_starter_claim(p_starter_id uuid) → { success, message }
reject_starter_claim(p_starter_id uuid) → { success, message }
```

### Vorschläge
```sql
create_suggestion(p_title, p_content) → { success, message }
respond_to_suggestion(p_suggestion_id, p_response, p_status) → { success, message }
```

### Kampfberichte & Auszahlungen
```sql
create_battle_report(p_clan_id, p_battle_date, p_overview_url, p_overview_hash)
  → { success, message, battle_report_id }
save_battle_casualties(p_battle_report_id, p_casualties jsonb) → { success, message }
calculate_payouts(p_battle_report_id) → { success, message }
mark_payout_paid(p_battle_report_id) → { success, message }
```

---

## 6. Navigation (Hamburger Drawer)

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

---

## 7. Playwright E2E-Tests

### Setup
- Config: `tests/playwright.config.ts` (testDir: '.')
- Workflow: `.github/workflows/playwright.yml` (läuft bei jedem Push auf main)
- `tsconfig.json` schließt `tests/` aus

### GitHub Secrets (alle eingerichtet)
| Secret | Beschreibung |
|--------|-------------|
| `PLAYWRIGHT_BASE_URL` | Vercel-URL |
| `TEST_ADMIN_USER` | `autoadmin` |
| `TEST_ADMIN_PASS` | `admin123` |
| `TEST_OFFICER_USER` | `autooffi` |
| `TEST_OFFICER_PASS` | `offi123` |
| `TEST_MEMBER_USER` | `automitglied` |
| `TEST_MEMBER_PASS` | `mitglied123` |
| `VERCEL_BYPASS_SECRET` | Vercel Protection Bypass for Automation |

### Vercel Bypass (playwright.config.ts)
```typescript
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://clanbank-web.vercel.app',
  extraHTTPHeaders: {
    'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_SECRET || '',
  },
}
```

### loginAs()-Muster (identisch in allen 5 Spec-Dateien)
```typescript
async function loginAs(page: any, user: string, pass: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/benutzername/i).fill(user)
  await page.getByPlaceholder(/passwort/i).fill(pass)
  await page.getByRole('button', { name: /anmelden/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 10000 })
  try {
    await page.locator('button[aria-label="Schließen"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('button[aria-label="Schließen"]').click()
    await page.locator('div.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5000 })
  } catch {} // Modal nicht erschienen
}
```

### Testaccounts
| Account | Rolle |
|---------|-------|
| `autoadmin` | admin |
| `autooffi` | offizier |
| `automitglied` | mitglied |

### Spec-Dateien
| Datei | Testfälle |
|-------|-----------|
| `auth.spec.ts` | Login, Redirect, Fehlermeldung (5) |
| `navigation.spec.ts` | Drawer, Tab-Sichtbarkeit, Abmelden (5) |
| `home.spec.ts` | Status, Backlog, Schnellzugriff (7) |
| `fcu.spec.ts` | Event anlegen, Upload, Ranking (8) |
| `announcements.spec.ts` | Erstellen, Anpinnen, Löschen (4) |

---

## 8. Key-Patterns

### Imports
```typescript
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
const { user, profile, loading, signOut } = useAuth()
```

### RPC aufrufen
```typescript
const { data, error } = await supabase.rpc('rpc_name', { p_param: value })
if (error || !data?.success) {
  setFeedback(data?.message || 'Fehler')
  return
}
```

### FK-Join (Ambiguität)
```typescript
supabase.from('deposits').select('*, profiles!deposits_user_id_fkey(ingame_name)')
```

### SHA-256
```typescript
const buf = await file.arrayBuffer()
const digest = await crypto.subtle.digest('SHA-256', buf)
const hash = Array.from(new Uint8Array(digest))
  .map(b => b.toString(16).padStart(2, '0')).join('')
```

### FCU sessionStorage
```typescript
// FCUUploadPanel schreibt:
sessionStorage.setItem('fcu_ocr_' + eventId, JSON.stringify(mergedRows))
// FCUResultsEditor liest + löscht nach Speichern:
sessionStorage.removeItem('fcu_ocr_' + eventId)
```

### Template Literals vermeiden (Turbopack)
```typescript
// ❌ const text = `Hallo ${name}`
// ✅ const text = 'Hallo ' + name
```

### Datei-Editierung
- **< 300 Zeilen** → vollständige Datei
- **> 300 Zeilen** → str_replace-Paare

### Kein lucide-react
```typescript
// ❌ import { AlertCircle } from 'lucide-react'
// ✅ Emoji: ⚠️ ✅ ❌ 💡
```

---

## 9. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------|
| Einzahlungen sehen | ✅ alle | ✅ alle | ✅ eigene |
| Einzahlungen genehmigen | ✅ | ✅ | ❌ |
| FCU Event anlegen | ✅ | ❌ | ❌ |
| FCU Ergebnisse sehen | ✅ | ✅ | ✅ (confirmed) |
| Ankündigungen erstellen | ✅ | ❌ | ❌ |
| Wand der Schande sehen | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |
| Kampfbericht hochladen | ✅ | ✅ | ❌ |

**Auth-Pattern:**
- Fake-Email: `username@clanbank.local`
- Clan-Code: `MAFIA2026`
- Supabase-ID Camorra Elite: `00000000-0000-0000-0000-000000000001`

---

## 10. Bekannte Fallstricke

| Problem | Lösung |
|---------|--------|
| `search_path`-Fehler bei RPCs | `SET search_path = public` in jede RPC |
| Supabase FK-Join-Ambiguität | `profiles!deposits_user_id_fkey(...)` |
| Vercel build schlägt fehl | `tests/` in `tsconfig.json` ausschließen |
| OCR-Modell-String falsch | Muss exakt `claude-haiku-4-5-20251001` sein |
| FCU-Namen ohne Match | Admin korrigiert manuell in FCUResultsEditor |
| sessionStorage leer nach Reload | FCUResultsEditor fällt auf DB-Ergebnisse zurück |
| Mehrere GitHub-Tabs | Können sich überschreiben — immer nur ein Tab |
| Playwright: WelcomeModal blockiert Klicks | `waitFor({ state: 'visible' })` + `waitFor({ state: 'hidden' })` in loginAs() |
| Playwright: Strict mode violation | Drawer-Buttons per `getByRole('navigation')` einschränken |
| Playwright: Ankündigungen limit(5) voll | Formular-Schliessung als Erfolgsindikator verwenden, nicht Titel in Liste suchen |
| `profiles` hat kein `deleted_at` | `.is('deleted_at', null)` auf profiles-Query weglassen |
| `is_raidleiter` / `is_test` PostgREST-Filter | `.eq(false)` und `.neq(true)` schließen NULL aus — immer JS-seitig filtern: `.filter(p => !p.is_raidleiter && !p.is_test)` |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
