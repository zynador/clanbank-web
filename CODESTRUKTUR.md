# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 27.03.2026 | Fahrplan V33
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
│   │   ├── ocr/
│   │   │   └── route.ts          ← Claude Haiku Vision OCR (alle Modi)
│   │   └── admin/
│   │       └── reset-password/
│   │           └── route.ts      ← Passwort-Reset (Service Role Key, nur Admin)
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
│   ├── BankImportPanel.tsx       ← Historischer Excel-Import (Idee 3)
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── ExemptionModal.tsx
│   ├── FCUEventTab.tsx           ← FCU Haupt-Container (Event-Liste, Navigation)
│   ├── FCUResultsEditor.tsx      ← OCR-Ergebnisse prüfen, Namen korrigieren, speichern
│   ├── FCURankingView.tsx        ← Gesamtranking über alle FCU Events
│   ├── FCUUploadPanel.tsx        ← Multi-Screenshot Upload + OCR pro Screen
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
  - Wand der Schande (Admin + Offizier): Grid-Layout mit kompakten Mitgliederkarten — **KEIN Avatar-Kreis**, nur Name + KW-Badge + Ressource-Emojis
  - `AnnouncementWidget` eingebettet
  - **Doppel-Podest Ranking:** Bank-Ranking + FCU-Ranking nebeneinander (Top 3 Podest + Plätze 4–5 als Zeilen) — **KEINE Avatar-Kreise**
  - Schnellzugriff auf alle 4 Hauptbereiche via `onNavigate`
- **loadBankRanking():** Nutzt `get_ranking_data` RPC (enthält historical_deposits) — NICHT direkter deposits-Query
- **avatarColor():** ❌ Entfernt (V33) — keine Avatar-Kreise mehr

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

---

### `HistoricalDepositsPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **Zweck:** Zeigt alle `historical_deposits` mit Filter (ausstehend/übertragen/alle) und Suchfeld
- **Stats:** Spieler ausstehend, Einträge ausstehend, übertragen
- **Eingebettet in:** `AdminPanel.tsx` (nach BankImportPanel)

---

### `ProfileMatchPanel.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin`
- **RPCs:** `get_unmatched_profiles`, `link_profile_to_starter`
- **Hinweis:** `link_profile_to_starter` löst automatisch `transfer_historical_deposits` aus

---

### `AdminPanel.tsx`
- **Props:** `lang: Lang`
- **Key-Sektionen:**
  - Einladungscode (MAFIA2026 immer sichtbar)
  - Passwort zurücksetzen
  - Starter-Members (StarterMembersPanel)
  - ProfileMatchPanel
  - BankImportPanel (Idee 3)
  - HistoricalDepositsPanel (Idee 3)

---

### `AnnouncementWidget.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** alle Rollen (Admin sieht Formular + Löschen-Button)
- **Hinweis:** Playwright-Tests hinterlassen Test-Ankündigungen — nach Testläufen manuell löschen

---

### `FCUEventTab.tsx`
- **Props:** `lang: Lang`
- **Key-States:** `view: 'list' | 'upload' | 'results' | 'ranking'`, `activeEventId`

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
- **RPC:** `get_ranking_data()` — enthält jetzt auch historical_deposits (UNION ALL)
- **Hinweis:** Raidleiter werden NICHT im Ranking angezeigt

---

### `BacklogWidget.tsx`
- **Props:** `lang: Lang`
- **Key-Function:** Ampelfarben für Rückstand, Raidleiter ausgeblendet

---

### `PayoutCalculation.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier`

---

### `SecurityAlerts.tsx`
- **Props:** `lang: Lang`
- **Dashboard-Tab:** "Warnungen" mit rotem Badge-Indikator

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

## 4. Datenbank

### Tabellen

#### `clans`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | `00000000-0000-0000-0000-000000000001` für Camorra Elite |
| invite_code | text | "MAFIA2026" |

#### `profiles`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | = auth.uid() |
| clan_id | uuid FK | |
| ingame_name | text | |
| display_name | text | |
| role | enum | `admin` / `offizier` / `mitglied` |
| is_raidleiter | boolean | Flag |
| is_test | boolean | Testaccounts |
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

### Views
- **`active_deposits`** — filtert approved + nicht-deleted Deposits

### Supabase Storage
- **Bucket:** `screenshots`

---

## 5. RPCs

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

---

## 6. Navigation (Hamburger Drawer)
```typescript
type Tab =
  | 'home' | 'deposits' | 'battle' | 'ranking' | 'fcu'
  | 'members' | 'freigabe' | 'vorschlaege' | 'warnungen' | 'verwaltung'
```

---

## 7. Playwright E2E-Tests

### GitHub Secrets
| Secret | Wert |
|--------|------|
| `PLAYWRIGHT_BASE_URL` | Vercel-URL |
| `TEST_ADMIN_USER` | `autoadmin` |
| `TEST_ADMIN_PASS` | `admin123` |
| `TEST_MEMBER_USER` | `automitglied` |
| `TEST_MEMBER_PASS` | `mitglied123` |
| `VERCEL_BYPASS_SECRET` | Vercel Protection Bypass |

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
-- In RPCs immer CASE-Mapping verwenden:
v_resource_enum := CASE v_resource
  WHEN 'cash'    THEN 'Cash'::resource_type
  WHEN 'arms'    THEN 'Arms'::resource_type
  WHEN 'cargo'   THEN 'Cargo'::resource_type
  WHEN 'metal'   THEN 'Metal'::resource_type
  WHEN 'diamond' THEN 'Diamond'::resource_type
END;
-- historical_deposits.resource_type ist plain text (lowercase) — kein ENUM!
```

### Bank-Ranking (HomeTab) — nutzt RPC statt direkter Query
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

## 9. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------|
| Einzahlungen sehen | ✅ alle | ✅ alle | ✅ eigene |
| Einzahlungen genehmigen | ✅ | ✅ | ❌ |
| FCU Event anlegen | ✅ | ❌ | ❌ |
| Ankündigungen erstellen | ✅ | ❌ | ❌ |
| Wand der Schande sehen | ✅ | ✅ | ❌ |
| Mitgliederliste sehen | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |
| Bank-Import (Idee 3) | ✅ | ❌ | ❌ |
| Passwort-Reset | ✅ | ❌ | ❌ |

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
| transfer_historical_deposits nicht aufgerufen | confirm_starter_claim + link_profile_to_starter rufen es automatisch auf |
| `SUPABASE_SERVICE_ROLE_KEY` fehlt | Vercel Projekt-Settings (nicht Team) — Sensitive Variable |
| Avatar-Kreise in Ranking/Members | ❌ Entfernt (V33) — avatarColor() + alle Avatar-Divs gelöscht |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
