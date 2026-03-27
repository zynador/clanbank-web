# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 27.03.2026 | Fahrplan V35
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)
```
clanbank-web/
├── .github/
│   └── workflows/
│       └── playwright.yml        ← GitHub Actions E2E-Tests (manuell via workflow_dispatch)
├── app/
│   ├── api/
│   │   ├── ocr/
│   │   │   └── route.ts          ← Claude Haiku Vision OCR (alle Modi)
│   │   ├── admin/
│   │   │   └── reset-password/
│   │   │       └── route.ts      ← Passwort-Reset (Service Role Key, nur Admin)
│   │   └── demo/
│   │       └── login/
│   │           └── route.ts      ← Demo-Gastaccount erstellen + Session setzen (Service Role Key)
│   ├── dashboard/
│   │   └── page.tsx              ← Haupt-App nach Login (Hamburger Drawer, tour_progress Check)
│   ├── demo/
│   │   └── page.tsx              ← Öffentliche Demo-Einstiegsseite (Rollenwahl, kein Auth-Check)
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
│   ├── BankImportPanel.tsx       ← Historischer Excel-Import (Idee 3)
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── ExemptionModal.tsx
│   ├── FCUEventTab.tsx           ← FCU Haupt-Container (Event-Liste, Navigation)
│   ├── FCUResultsEditor.tsx      ← OCR-Ergebnisse prüfen, Namen korrigieren, speichern
│   ├── FCURankingView.tsx        ← Gesamtranking über alle FCU Events
│   ├── FCUUploadPanel.tsx        ← Multi-Screenshot Upload + OCR pro Screen
│   ├── GuidedTour.tsx            ← Floating Tooltip + Highlight-Ring (NUR Member-Tour)
│   ├── HelpButton.tsx
│   ├── HistoricalDepositsPanel.tsx ← Admin: Status aller historical_deposits
│   ├── HomeTab.tsx               ← Startseite (Status, Backlog, Ankündigungen, Doppel-Podest Ranking)
│   ├── InfoTooltip.tsx
│   ├── Logo.tsx                  ← KEINE Props
│   ├── MembersTab.tsx            ← Mitgliederliste (Suchfeld, Filter, kompaktes Karten-Layout)
│   ├── PayoutCalculation.tsx
│   ├── ProfileMatchPanel.tsx     ← Fuzzy-Matching ungematchter Profile mit Starter-Einträgen
│   ├── RankingTab.tsx
│   ├── ScreenshotThumb.tsx
│   ├── ScreenshotUpload.tsx
│   ├── SecurityAlerts.tsx
│   ├── StarterMembersPanel.tsx
│   ├── SuggestionBox.tsx
│   ├── TourButton.tsx            ← Schwebender ? Button unten rechts (Member-Tour Trigger)
│   └── WelcomeModal.tsx
├── hooks/
│   └── useExemptions.ts          ← Custom Hook für member_exemptions
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
  - **Wand der Schande (alle Rollen):** Grid-Layout mit kompakten Mitgliederkarten — registrierte Mitglieder + nicht-registrierte Starter mit 🆕-Badge
  - `AnnouncementWidget` eingebettet
  - **Doppel-Podest Ranking:** Bank-Ranking + FCU-Ranking nebeneinander (Top 3 Podest + Plätze 4–5 als Zeilen) — **KEINE Avatar-Kreise**
  - Schnellzugriff auf alle 4 Hauptbereiche via `onNavigate`
- **loadBankRanking():** Nutzt `get_ranking_data` RPC (enthält historical_deposits) — NICHT direkter deposits-Query
- **loadBacklog():** Lädt `profiles` (aktive, nicht is_test/is_raidleiter/is_bank) + `starter_members` (claimed_by IS NULL, left_clan_at IS NULL). Starter mit gleichem ingame_name wie ein Profil werden ausgeschlossen.
- **loadDetail():** Für registrierte Mitglieder: `deposits` + `historical_deposits` (transferred=false). Für Starter: nur `historical_deposits` (alle). **Immer `.toLowerCase()` auf resource_type** — ENUM liefert `'Cash'`, historical liefert `'cash'`.
- **BacklogMember / MemberDetail:** optionales Feld `is_starter?: boolean`
- **avatarColor():** ❌ Entfernt (V33) — keine Avatar-Kreise mehr
- **data-tour-id Attribute:** `home-status`, `home-ranking-bank`, `home-ranking-fcu`, `home-backlog`
- **⚠️ Offener Punkt:** Detailansicht erscheint inline nach ALLEN Kacheln — bei vielen Einträgen außerhalb Sichtfeld. Geplant: Modal/Overlay.

---

### `MembersTab.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier`
- **Key-Features:**
  - Suchfeld (ingame_name + display_name, mit Clear-Button)
  - Filter: Alle / Aktiv / Ausstehend / Ausgetreten / Nicht gematcht (N)
  - Karten-Layout kompakt: Name + `@display_name` links, Rolle- und Registrierungsstatus-Badges inline rechts
  - Raidleiter-Badge + Ausnahme-Badge: eigene Zeile, nur konditionell wenn vorhanden
  - Expand-on-click für Aktionen
- **Entfernt (V33):** Avatar-Kreis (38px), Match-Dot, Match-Legende, `matchDot()`-Funktion
- **Abhängigkeiten:** `ExemptionModal`, `ExemptionBadge`, `useExemptions`
- **RPC:** `get_members_list`
- **data-tour-id Attribute:** `members-search`

---

### `DepositsTab.tsx`
- **data-tour-id Attribute:** `deposits-list`, `deposits-add-btn`

---

### `FCUEventTab.tsx`
- **Props:** `lang: Lang`
- **Key-States:** `view: 'list' | 'upload' | 'results' | 'ranking'`, `activeEventId`
- **data-tour-id Attribute:** `fcu-list`, `fcu-ranking-btn`

---

### `GuidedTour.tsx`
- **Props:**
  - `steps: TourStep[]` — rollengefiltertes Schritt-Array
  - `onNavigate: (tab: string) => void` — Tab-Wechsel-Callback
  - `onComplete: () => void` — Callback wenn Tour abgeschlossen
  - `onSkip: () => void` — Callback wenn abgebrochen
- **NUR für Member-Tour** — Demo-Nutzer haben keinen GuidedTour
- **Mechanismus:** Floating Tooltip + Highlight-Ring (box-shadow Overlay Technik)
- **Tooltip-Positionierung:** `getBoundingClientRect()` → rechts > links > unten > oben
- **Scroll:** `scrollIntoView({ behavior: 'smooth', block: 'center' })` vor Tooltip-Render
- **Keyboard:** ESC = abbrechen, Pfeil rechts = weiter, Pfeil links = zurück
- **Backdrop:** Dunkles Overlay außerhalb Highlight-Bereich (`pointer-events: none`)

```typescript
interface TourStep {
  id: string           // z.B. 'home-ranking'
  targetId: string     // Wert des data-tour-id Attributs am Ziel-Element
  tab: string          // Tab der vor dem Schritt aktiviert wird
  title: string        // Tooltip-Überschrift
  body: string         // Erklärungstext (2-3 Sätze)
  roles: UserRole[]    // Rollen die diesen Schritt sehen
}
```

---

### `TourButton.tsx`
- **Props:** `onClick: () => void`
- **Darstellung:** Schwebender `?` Button, `position: fixed`, unten rechts
- **Sichtbar:** Immer im Dashboard (für alle echten Rollen)
- **Funktion:** Startet Member-Tour neu

---

### `BankImportPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **Key-Features:**
  - Excel-Upload (.xlsx) mit automatischer Format-Erkennung (Breit: Name|Cash|Arms... / Lang: Name|Ressource|Menge)
  - KW + Jahr einstellbar (default: aktuelle KW)
  - Alle Spieler importierbar — registrierte direkt als `deposits`, nicht-registrierte in `historical_deposits`
  - Dropdown für unbekannte Namen: registrierte (optgroup 1) + nicht-registrierte Starter (optgroup 2, `ingame:`-Prefix)
  - Duplikatschutz in beiden Tabellen
- **xlsx-Import:** `const xlsxMod = await import('xlsx') as any; const XLSX = xlsxMod.default ?? xlsxMod`
- **RPC:** `import_historical_deposits`
- **Eingebettet in:** `AdminPanel.tsx`
- **data-tour-id:** `admin-bank-import`

---

### `HistoricalDepositsPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **Zweck:** Zeigt alle `historical_deposits` mit Filter (ausstehend/übertragen/alle) und Suchfeld
- **Eingebettet in:** `AdminPanel.tsx` (nach BankImportPanel)

---

### `AdminPanel.tsx`
- **Props:** `lang: Lang`
- **Key-Sektionen:** Einladungscode, Passwort-Reset, StarterMembersPanel, ProfileMatchPanel, BankImportPanel, HistoricalDepositsPanel
- **data-tour-id Attribute:** `admin-password-reset`, `admin-bank-import`

---

### `ProfileMatchPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **RPCs:** `get_unmatched_profiles`, `link_profile_to_starter`
- **Hinweis:** `link_profile_to_starter` löst automatisch `transfer_historical_deposits` aus

---

### `AnnouncementWidget.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin sieht Formular + Löschen-Button)

---

### `FCUResultsEditor.tsx`
- **Props:** `lang: Lang`, `eventId: string`, `onBack: () => void`
- **Bearbeiten-Button** (nur Admin, nur bei `confirmed`): ruft `reopen_fcu_event` RPC auf

---

### `FCURankingView.tsx`
- **Props:** `lang: Lang`, `onBack: () => void`
- **Sortierung:** höchste Gesamtpunktzahl = Platz 1 (total_points DESC)

---

### `ScreenshotUpload.tsx`
- **Props:** `lang: Lang`, `clanId: string`, `onUploadComplete: (url: string, hash: string | null) => void`, `maxAgeDays?: number`
- **Default maxAgeDays:** 4 (Einzahlungen), BattleReport: 7

---

### `BattleReportUpload.tsx`
- **Props:** `lang: Lang`, `onComplete?: (battleReportId: string) => void`
- **OCR-Modi:** `battle_overview` / `battle_detail`

---

### `RankingTab.tsx`
- **Props:** `lang: Lang`
- **RPC:** `get_ranking_data()` — enthält auch historical_deposits (UNION ALL)
- **Hinweis:** Raidleiter werden NICHT im Ranking angezeigt

---

### `BacklogWidget.tsx`
- **Props:** `lang: Lang`
- **Key-Function:** Ampelfarben für Rückstand, Raidleiter ausgeblendet

---

### `WelcomeModal.tsx` / `HelpButton.tsx`
- **Schließen-Button:** `aria-label="Schließen"` ← wichtig für Playwright-Tests

---

## 3. API-Routen

### `app/api/ocr/route.ts`
- **Model:** `claude-haiku-4-5-20251001`
- **max_tokens:** 2048

| Mode | Beschreibung |
|------|-------------|
| `deposit` | Einzahlungs-Screenshot — 5 Ressourcen, filtert "Bam bamm" |
| `battle_overview` | Kampfbericht Übersicht — Datum, Seite |
| `battle_detail` | Kampfbericht Detail — Verwundete T4+ |
| `fcu` | FCU-Rangliste — Rang, Name, Punkte |

---

### `app/api/admin/reset-password/route.ts`
- **Methode:** POST
- **Env:** `SUPABASE_SERVICE_ROLE_KEY`

---

### `app/api/demo/login/route.ts`
- **Methode:** POST
- **Env:** `SUPABASE_SERVICE_ROLE_KEY`
- **Body:** `{ role: 'admin' | 'offizier' | 'mitglied' }`
- **Ablauf:** Erstellt Gastaccount im Demo-Clan via `auth.admin.createUser()`, setzt Session, Redirect zu `/dashboard`
- **Kein Auth-Check** — Route ist öffentlich
- **Demo-Clan-UUID:** `00000000-0000-0000-0000-000000000002`

---

## 4. Seiten

### `app/demo/page.tsx`
- **Kein Auth-Check** — vollständig öffentlich, kein Einladungscode
- **Inhalt:** 3 Rollenkarten (Admin / Offizier / Mitglied) mit Funktionsbeschreibung
- **Klick auf Karte:** POST `/api/demo/login` → Redirect `/dashboard`
- **Kein GuidedTour** im Demo-Modus — freies Erkunden
- **Link:** Zurück zu `/login`

---

## 5. Datenbank

### Tabellen

#### `clans`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | `00000000-0000-0000-0000-000000000001` = Camorra Elite |
| id | uuid PK | `00000000-0000-0000-0000-000000000002` = Demo-Clan |
| invite_code | text | "MAFIA2026" (Camorra Elite) / NULL (Demo-Clan) |

#### `profiles`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | = auth.uid() |
| clan_id | uuid FK | |
| ingame_name | text | |
| display_name | text | |
| role | enum | `admin` / `offizier` / `mitglied` |
| is_raidleiter | boolean | Flag |
| is_test | boolean | Testaccounts + Demo-Gastaccounts |
| left_clan_at | timestamptz | Soft-Delete (kein deleted_at!) |

#### `deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| resource_type | enum | **Cash/Arms/Cargo/Metal/Diamond (grossgeschrieben!)** |
| status | enum | `pending` / `approved` / `rejected` |
| screenshot_url | text | nullable (historische Imports haben keinen Screenshot) |
| deleted_at | timestamptz | Soft-Delete |

#### `starter_members`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| ocr_alias | text | Alternative OCR-Schreibweise (nullable) |
| left_clan_at | timestamptz | Soft-Delete (kein deleted_at!) |

#### `historical_deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| clan_id | uuid FK | |
| ingame_name | text | Spielername |
| resource_type | text | lowercase: cash/arms/cargo/metal/diamond (plain text, kein ENUM!) |
| amount | bigint | |
| import_kw | int | Kalenderwoche des Imports |
| import_year | int | Jahr des Imports |
| transferred | boolean | false = ausstehend, true = in deposits übertragen |
| deposit_id | uuid | FK → deposits.id (nach Transfer gesetzt) |
| created_at | timestamptz | |

#### `member_exemptions`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| is_active | boolean | aktive Ausnahmen: `WHERE is_active = true` (kein deleted_at) |

#### `tour_progress`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| completed | boolean | default false |
| last_step | int | letzter abgeschlossener Schritt-Index |
| updated_at | timestamptz | |

- **RLS:** `user_id = auth.uid()` — Nutzer sieht nur eigenen Eintrag
- **Demo-Nutzer:** Kein Eintrag — Demo hat keinen GuidedTour

### Views
- **`active_deposits`** — filtert approved + nicht-deleted Deposits

### Supabase Storage
- **Bucket:** `screenshots`

### Demo-Clan Seed-Daten (einmalig per SQL, nie zurücksetzen)
| Tabelle | Inhalt |
|---------|--------|
| profiles | 5 Einträge: 1 Admin, 1 Offizier, 3 Mitglieder — alle `is_test = true` |
| deposits | ~30 Einzahlungen, 8 Wochen, alle 5 Ressourcentypen |
| starter_members | 3 nicht-registrierte Starter |
| fcu_events | 2 abgeschlossene Events mit Ergebnissen |
| battle_reports | 1 Kampfbericht mit berechneten Auszahlungen |
| announcements | 2 Ankündigungen (1 angepinnt) |
| historical_deposits | 5 Einträge für Demo-Starter |

**RLS Demo-Clan:** Policies für `clan_id = '00000000-0000-0000-0000-000000000002'` erlauben nur `SELECT` — kein INSERT/UPDATE/DELETE.

---

## 6. RPCs

### Hilfs-Funktionen
```sql
get_my_clan_id() → uuid
get_my_role()    → text
```

### Mitglieder
```sql
get_members_list(p_clan_id uuid)
  → TABLE(source, profile_id, starter_id, ingame_name, ...)

get_members_for_import(p_clan_id uuid)
  → TABLE(profile_id uuid, ingame_name text, is_registered boolean)

get_unmatched_profiles(p_clan_id uuid)
link_profile_to_starter(p_profile_id uuid, p_starter_id uuid)
  → { success, message }
  -- Löst automatisch transfer_historical_deposits aus!

add_clan_member / mark_member_left / reactivate_member
set_member_start_kw / set_raidleiter_flag
```

### Historische Deposits (Idee 3)
```sql
import_historical_deposits(p_clan_id uuid, p_deposits jsonb)
  → { success, message, imported, direct_deposits, skipped_duplicates }

transfer_historical_deposits(p_profile_id uuid, p_ingame_name text, p_clan_id uuid)
  → { success, transferred }
  -- Automatisch aufgerufen von confirm_starter_claim + link_profile_to_starter
```

### Starter-Mitglieder
```sql
import_starter_members / claim_starter_profile
confirm_starter_claim(p_starter_id uuid)
  → { success, message }
  -- Löst automatisch transfer_historical_deposits aus!
reject_starter_claim(p_starter_id uuid)
```

### Ranking
```sql
get_ranking_data(p_year int, p_kw int, p_month int)
  → TABLE(user_id, ingame_name, username, start_kw, start_year,
           threshold_per_res, deposit_cash, deposit_arms, deposit_cargo,
           deposit_metal, deposit_diamond, total_deposit)
  -- UNION ALL: registrierte (active_deposits) + nicht-registrierte (historical_deposits)
  -- Verwendet get_my_clan_id() intern (kein p_clan_id Parameter!)
```

### FCU
```sql
create_fcu_event / save_fcu_results / get_fcu_overall_ranking
reopen_fcu_event(p_fcu_event_id uuid) → { success, message }
create_announcement / delete_announcement
```

### Einzahlungen
```sql
create_bulk_deposit(p_clan_id, p_deposits jsonb) → { success, message }
check_screenshot_hash(p_hash, p_clan_id) → { exists: boolean }
```

### Kampfberichte & Auszahlungen
```sql
create_battle_report / save_battle_casualties
calculate_payouts / mark_payout_paid
```

### Tour (Idee 7)
```sql
get_or_create_tour_progress()
  → { completed: boolean, last_step: int }

update_tour_progress(p_last_step int, p_completed boolean)
  → { success, message }
```

---

## 7. Navigation (Hamburger Drawer)
```typescript
type Tab =
  | 'home' | 'deposits' | 'battle' | 'ranking' | 'fcu'
  | 'members' | 'freigabe' | 'vorschlaege' | 'warnungen' | 'verwaltung'
```

---

## 8. data-tour-id Attribute (Member-Tour)

Alle Ziel-Elemente für `GuidedTour.tsx` erhalten ein `data-tour-id` Attribut.
Niemals auf CSS-Klassen oder generische IDs als Tour-Target verlassen.

| data-tour-id | Komponente | Element |
|---|---|---|
| `home-status` | HomeTab | Persönlicher Status (grün/rot) |
| `home-ranking-bank` | HomeTab | Bank-Ranking-Podest |
| `home-ranking-fcu` | HomeTab | FCU-Ranking-Podest |
| `home-backlog` | HomeTab | Wand der Schande Grid |
| `deposits-list` | DepositsTab | Einzahlungsliste |
| `deposits-add-btn` | DepositsTab | Neue Einzahlung Button |
| `fcu-list` | FCUEventTab | FCU Event-Liste |
| `fcu-ranking-btn` | FCUEventTab | Gesamtranking Button |
| `members-search` | MembersTab | Suchfeld |
| `admin-password-reset` | AdminPanel | Passwort-Reset Sektion |
| `admin-bank-import` | AdminPanel | BankImportPanel Sektion |

---

## 9. Playwright E2E-Tests

### GitHub Secrets
| Secret | Wert |
|--------|------|
| `PLAYWRIGHT_BASE_URL` | Vercel-URL |
| `TEST_ADMIN_USER` | `autoadmin` |
| `TEST_ADMIN_PASS` | `admin123` |
| `TEST_MEMBER_USER` | `automitglied` |
| `TEST_MEMBER_PASS` | `mitglied123` |
| `VERCEL_BYPASS_SECRET` | Vercel Protection Bypass |

### Offene Punkte (Stand V35)
- `home.spec.ts`: Test `Mitglied sieht KEINEN Rueckstand Block` muss angepasst werden — Wand der Schande ist jetzt für alle sichtbar

### loginAs()-Muster
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
  } catch {}
}
```

---

## 10. Key-Patterns

### Imports
```typescript
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
const { user, profile, loading, signOut } = useAuth()
```

### RPC aufrufen
```typescript
const { data, error } = await supabase.rpc('rpc_name', { p_param: value })
if (error || !data?.success) { setFeedback(data?.message || 'Fehler'); return }
```

### FK-Join (Ambiguität)
```typescript
supabase.from('deposits').select('*, profiles!deposits_user_id_fkey(ingame_name)')
```

### SHA-256
```typescript
const buf = await file.arrayBuffer()
const digest = await crypto.subtle.digest('SHA-256', buf)
const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
```

### xlsx-Import (Turbopack-safe)
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const xlsxMod = await import('xlsx') as any
const XLSX = xlsxMod.default ?? xlsxMod
```

### resource_type ENUM (grossgeschrieben!)
```sql
-- Enum-Werte: Cash, Arms, Cargo, Metal, Diamond (NICHT lowercase!)
v_resource_enum := CASE v_resource
  WHEN 'cash'    THEN 'Cash'::resource_type
  WHEN 'arms'    THEN 'Arms'::resource_type
  WHEN 'cargo'   THEN 'Cargo'::resource_type
  WHEN 'metal'   THEN 'Metal'::resource_type
  WHEN 'diamond' THEN 'Diamond'::resource_type
END;
-- historical_deposits.resource_type ist plain text (lowercase) — kein ENUM!
```

### loadDetail() resource_type normalisieren (HomeTab)
```typescript
// deposits.resource_type ist ENUM (grossgeschrieben) → immer normalisieren!
const rt = (d.resource_type as string).toLowerCase() as ResourceType
// historical_deposits.resource_type ist bereits lowercase — .toLowerCase() schadet nicht
```

### Bank-Ranking (HomeTab)
```typescript
// RICHTIG: get_ranking_data enthält historical_deposits
const { data } = await supabase.rpc('get_ranking_data')
// FALSCH: direkter deposits-Query fehlen historical_deposits
```

### Passwort-Reset
```typescript
const { data: { session } } = await supabase.auth.getSession()
const res = await fetch('/api/admin/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token ?? '') },
  body: JSON.stringify({ targetUserId, newPassword }),
})
```

### Demo-Login
```typescript
// Kein Auth-Token nötig — Route ist öffentlich
const res = await fetch('/api/demo/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'admin' }), // 'admin' | 'offizier' | 'mitglied'
})
// Bei Erfolg: redirect zu /dashboard
```

### tour_progress laden
```typescript
const { data } = await supabase.rpc('get_or_create_tour_progress')
// data: { completed: boolean, last_step: number }
if (!data.completed) { /* Tour starten */ }
```

### Template Literals vermeiden (Turbopack)
```typescript
// ❌ const text = `Hallo ${name}`
// ✅ const text = 'Hallo ' + name
```

### Datei-Editierung
- Immer vollständige Datei liefern (keine str_replace-Snippets)

### Kein lucide-react
```typescript
// ❌ import { AlertCircle } from 'lucide-react'
// ✅ Emoji: ⚠️ ✅ ❌ 💡
```

---

## 11. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------|
| Einzahlungen sehen | ✅ alle | ✅ alle | ✅ eigene |
| Einzahlungen genehmigen | ✅ | ✅ | ❌ |
| FCU Event anlegen | ✅ | ❌ | ❌ |
| Ankündigungen erstellen | ✅ | ❌ | ❌ |
| Wand der Schande sehen | ✅ | ✅ | ✅ |
| Mitgliederliste sehen | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |
| Bank-Import (Idee 3) | ✅ | ❌ | ❌ |
| Passwort-Reset | ✅ | ❌ | ❌ |
| Member-Tour Schritte | ✅ 1–9 | ➖ 1–7 | ➖ 1–4 |

**Auth-Pattern:**
- Fake-Email: `username@clanbank.local`
- Clan-Code: `MAFIA2026`
- Supabase-ID Camorra Elite: `00000000-0000-0000-0000-000000000001`
- Supabase-ID Demo-Clan: `00000000-0000-0000-0000-000000000002`

---

## 12. Bekannte Fallstricke

| Problem | Lösung |
|---------|--------|
| `search_path`-Fehler bei RPCs | `SET search_path = public` in jede RPC |
| Supabase FK-Join-Ambiguität | `profiles!deposits_user_id_fkey(...)` |
| Vercel build schlägt fehl | `tests/` in `tsconfig.json` ausschließen |
| OCR-Modell-String falsch | Muss exakt `claude-haiku-4-5-20251001` sein |
| Playwright: WelcomeModal blockiert | `waitFor({ state: 'visible' })` + `waitFor({ state: 'hidden' })` |
| Playwright: Strict mode violation | Drawer-Buttons per `getByRole('navigation')` einschränken |
| `profiles` hat kein `deleted_at` | Soft-Delete über `left_clan_at` |
| `starter_members` hat kein `deleted_at` | Soft-Delete über `left_clan_at` |
| `member_exemptions`: aktive Ausnahmen | `WHERE is_active = true` — kein deleted_at |
| `is_test` / `is_raidleiter` PostgREST `.eq(false)` | JS-seitig filtern via excludeIds Set |
| UNION ALL mit ORDER BY | In Subquery wrappen |
| resource_type ENUM grossgeschrieben | Cash/Arms/Cargo/Metal/Diamond — CASE-Mapping in RPCs |
| xlsx Turbopack-Interop | `const XLSX = xlsxMod.default ?? xlsxMod` |
| historical_deposits resource_type | plain text (lowercase) — kein ENUM! |
| get_ranking_data zwei Versionen | DROP FUNCTION IF EXISTS für beide Signaturen |
| get_ranking_data kein p_clan_id | Nutzt `get_my_clan_id()` intern — kein Parameter! |
| HomeTab Bank-Ranking fehlt historical | `get_ranking_data` RPC nutzen — nicht direkter deposits-Query |
| loadDetail() zeigt 0 für alle Werte | deposits.resource_type ist ENUM → immer `.toLowerCase()` normalisieren |
| transfer_historical_deposits nicht aufgerufen | confirm_starter_claim + link_profile_to_starter rufen es automatisch auf |
| `SUPABASE_SERVICE_ROLE_KEY` fehlt | Vercel Projekt-Settings (nicht Team) — Sensitive Variable |
| Avatar-Kreise in Ranking/Members | ❌ Entfernt (V33) — avatarColor() + alle Avatar-Divs gelöscht |
| Demo-RLS: nur SELECT | RLS-Policies auf Demo-Clan-UUID — kein INSERT/UPDATE/DELETE |
| Demo-Clan invite_code | NULL setzen — /demo braucht keinen Code |
| tour_progress für Demo-Nutzer | Nicht in DB schreiben — Demo hat keinen GuidedTour |
| Tooltip-Position berechnen | `getBoundingClientRect()` → rechts > links > unten > oben |
| data-tour-id Konflikte | Immer spezifische IDs — nie generische wie `btn` oder `table` |
| Wand der Schande Detail außerhalb Sichtfeld | Bei 97+ Kacheln: geplant als Modal/Overlay (offener Punkt V35) |
| Playwright home.spec.ts Mitglied-Test | "Mitglied sieht KEINEN Rueckstand Block" anpassen — Wand für alle sichtbar |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
