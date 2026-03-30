# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 30.03.2026 | Fahrplan V37
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)
```
clanbank-web/
├── .github/
│   └── workflows/
│       └── playwright.yml        ← GitHub Actions E2E-Tests (manuell via workflow_dispatch, Node.js 22)
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

### `HomeTab.tsx`
- **Props:** `lang: Lang`, `onNavigate: (tab: string) => void`
- **Key-Sections:**
  - Persönlicher Clanbank-Status (grün/rot)
  - **Wand der Schande:** Grid — nur Mitglieder/Starter MIT Rückstand. Klick öffnet **Modal/Overlay** (fixed z-50)
  - **„🆕 Noch nicht registriert":** Eigenes blaues Panel für Starter OHNE Rückstand (vollständig eingezahlt)
  - `AnnouncementWidget` eingebettet
  - **Doppel-Podest Ranking:** Bank + FCU nebeneinander
  - Schnellzugriff auf alle 4 Hauptbereiche
- **State:**
  - `backlog: BacklogMember[]` — registrierte Mitglieder mit Rückstand + Starter mit Rückstand
  - `starters: BacklogMember[]` — Starter ohne Rückstand (eigener Abschnitt)
- **loadBacklog():**
  - Supabase-Query-Ergebnis heißt `starterRows` (nicht `starters`) — kein Konflikt mit State
  - Bulk-Query `historical_deposits` per `.in('ingame_name', starterNames)` für alle Starter auf einmal
  - Pro Starter: Ressourcen summieren, gegen `(currentKw - 2) × 5M` prüfen
  - Fehlende Ressourcen → `startersBehind` → Wand der Schande
  - Alles grün → `startersPaid` → `starters`-State (eigener Abschnitt)
  - **paidSet:** `d.resource_type` IMMER `.toLowerCase()` — DB liefert `'Cash'`, RESOURCES-Array `'cash'`
- **loadDetail():** aufgeteilt in `loadDetailForStarter()` + `loadDetailForMember()` (je < 30 Zeilen)
- **Modal:** `fixed inset-0 z-50`, Backdrop `rgba(0,0,0,0.45)`, Klick außen schließt
- **data-tour-id Attribute:** `home-status`, `home-ranking-bank`, `home-ranking-fcu`, `home-backlog`

---

### `MembersTab.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier`
- **Entfernt (V33):** Avatar-Kreis, Match-Dot, Match-Legende
- **RPC:** `get_members_list`
- **data-tour-id:** `members-search`

---

### `GuidedTour.tsx`
- **NUR für Member-Tour** — Demo-Nutzer haben keinen GuidedTour
- **Mechanismus:** Floating Tooltip + Highlight-Ring (box-shadow)
- **Keyboard:** ESC = abbrechen, Pfeil rechts = weiter, Pfeil links = zurück

---

### `BankImportPanel.tsx`
- **xlsx-Import:** `const xlsxMod = await import('xlsx') as any; const XLSX = xlsxMod.default ?? xlsxMod`
- **RPC:** `import_historical_deposits`
- **data-tour-id:** `admin-bank-import`

---

### `AdminPanel.tsx`
- **data-tour-id Attribute:** `admin-password-reset`, `admin-bank-import`

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
- **Methode:** POST / **Env:** `SUPABASE_SERVICE_ROLE_KEY`

### `app/api/demo/login/route.ts`
- **Methode:** POST / **Env:** `SUPABASE_SERVICE_ROLE_KEY`
- **Demo-Clan-UUID:** `00000000-0000-0000-0000-000000000002`

---

## 4. Seiten

### `app/demo/page.tsx`
- **Kein Auth-Check** — vollständig öffentlich
- **Klick auf Karte:** POST `/api/demo/login` → Redirect `/dashboard`
- **Kein GuidedTour** im Demo-Modus

---

## 5. Datenbank

### Tabellen (Auszug)

#### `deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| resource_type | enum | **Cash/Arms/Cargo/Metal/Diamond (grossgeschrieben!)** |

#### `historical_deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| resource_type | text | lowercase: cash/arms/cargo/metal/diamond (plain text, kein ENUM!) |
| transferred | boolean | false = ausstehend, true = übertragen |

#### `tour_progress`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| user_id | uuid FK | RLS: user_id = auth.uid() |
| completed | boolean | default false |
| last_step | int | letzter Schritt-Index |

---

## 6. RPCs

```sql
get_my_clan_id() → uuid
get_my_role()    → text
get_ranking_data()  -- kein p_clan_id! Nutzt get_my_clan_id() intern
get_fcu_overall_ranking(p_clan_id uuid)
import_historical_deposits(p_clan_id uuid, p_deposits jsonb)
transfer_historical_deposits(p_profile_id uuid, p_ingame_name text, p_clan_id uuid)
confirm_starter_claim(p_starter_id uuid)   -- löst transfer_historical_deposits aus
link_profile_to_starter(p_profile_id uuid, p_starter_id uuid)  -- löst transfer aus
get_or_create_tour_progress() → { completed, last_step }
update_tour_progress(p_last_step int, p_completed boolean)
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

| data-tour-id | Komponente | Element |
|---|---|---|
| `home-status` | HomeTab | Persönlicher Status |
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

### Offene Punkte (Stand V37)
Keine offenen Punkte.

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

### resource_type normalisieren (HomeTab loadBacklog + loadDetail)
```typescript
// IMMER .toLowerCase() — deposits-ENUM liefert 'Cash', RESOURCES-Array erwartet 'cash'
paidSet.add(d.user_id + '_' + (d.resource_type as string).toLowerCase() + '_' + kw)
const rt = (d.resource_type as string).toLowerCase() as ResourceType
```

### Starter Bulk-Query (HomeTab loadBacklog)
```typescript
// NICHT in Schleife einzeln abfragen — eine Bulk-Query für alle Starter-Namen
const { data: histDeposits } = starterNames.length > 0
  ? await supabase.from('historical_deposits').select('ingame_name, resource_type, amount')
      .eq('clan_id', profile.clan_id).in('ingame_name', starterNames)
  : { data: [] }
```

### Variable-Konflikt vermeiden (HomeTab)
```typescript
// Supabase-Ergebnis heißt starterRows (nicht starters) — kein Konflikt mit useState starters
const { data: starterRows } = await supabase.from('starter_members')...
const activeStarters = (starterRows ?? []).filter(...)
```

### Modal-Pattern (Wand der Schande)
```typescript
// Backdrop: Klick schließt. Inner div: e.stopPropagation()
<div className="fixed inset-0 z-50 flex items-center justify-center p-4"
  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={closeDetail}>
  <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
    onClick={e => e.stopPropagation()}>
    ...
  </div>
</div>
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
| Wand der Schande sehen | ✅ | ✅ | ✅ |
| Mitgliederliste sehen | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |
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
| `profiles` hat kein `deleted_at` | Soft-Delete über `left_clan_at` |
| `starter_members` hat kein `deleted_at` | Soft-Delete über `left_clan_at` |
| `member_exemptions`: aktive Ausnahmen | `WHERE is_active = true` — kein deleted_at |
| `is_test` / `is_raidleiter` PostgREST `.eq(false)` | JS-seitig filtern via excludeIds Set |
| resource_type ENUM grossgeschrieben | Cash/Arms/Cargo/Metal/Diamond — immer `.toLowerCase()` in JS |
| historical_deposits resource_type | plain text (lowercase) — kein ENUM! |
| get_ranking_data kein p_clan_id | Nutzt `get_my_clan_id()` intern — kein Parameter! |
| loadBacklog() paidSet: kein Match | `.toLowerCase()` auf resource_type vergessen — DB liefert 'Cash' |
| Starter-State vs. Query-Ergebnis | Query-Ergebnis heißt `starterRows`, State heißt `starters` |
| Modal blockiert Playwright-Test | `div.fixed.inset-0.z-50` — selber Selektor wie WelcomeModal |
| TypeScript: 'members' not found | State umbenannt → alle JSX-Refs (`members.length`, `members.map`) mitumbenennen |
| Avatar-Kreise in Ranking/Members | ❌ Entfernt (V33) |
| Demo-RLS: nur SELECT | RLS-Policies auf Demo-Clan-UUID |
| tour_progress für Demo-Nutzer | Nicht in DB schreiben — Demo hat keinen GuidedTour |
| GitHub Actions Node.js Deprecation | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` + `node-version: 22` in `playwright.yml` |
| UNION ALL mit ORDER BY | In Subquery wrappen |
| xlsx Turbopack-Interop | `const XLSX = xlsxMod.default ?? xlsxMod` |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
