# ClanBank — Codestruktur

> **Letzte Aktualisierung:** 21.03.2026 | Fahrplan V24
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
- **Wichtig:** NICHT in `<label>`-Tag einbetten:
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
- **OCR-Modi:** `battle_overview` / `battle_detail`
- **Kampfdatum:** Pflichtfeld, oranger Rahmen wenn leer

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
- **Hinweis:** Raidleiter (`is_raidleiter = true`) werden NICHT angezeigt

---

### `PayoutCalculation.tsx`
- **Props:** `lang: Lang`
- **Sichtbar für:** `admin` und `offizier`

---

### `SecurityAlerts.tsx` / `StarterMembersPanel.tsx` / `SuggestionBox.tsx` / `AdminPanel.tsx`
- **Props:** `lang: Lang`

### `WelcomeModal.tsx` / `HelpButton.tsx`
- **Props:** `lang: Lang`, `onClose: () => void` (WelcomeModal)

---

## 3. API-Routen

### `app/api/ocr/route.ts`
- **Model:** `claude-haiku-4-5-20251001` ← GENAU so
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

---

## 4. Datenbank

### Tabellen

#### `clans`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | `00000000-0000-0000-0000-000000000001` für Camorra Elite |
| name | text | "Camorra Elite" |
| invite_code | text | "MAFIA2026" |

#### `profiles`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | = auth.uid() |
| clan_id | uuid FK | → clans.id |
| ingame_name | text | |
| display_name | text | |
| role | enum | `admin` / `offizier` / `mitglied` |
| is_raidleiter | boolean | |
| deleted_at | timestamptz | Soft-Delete |

#### `deposits`
| Spalte | Typ | Hinweis |
|--------|-----|---------|
| id | uuid PK | |
| user_id | uuid FK | |
| clan_id | uuid FK | |
| resource_type | text | cash / arms / cargo / metal / diamond |
| amount | bigint | |
| status | enum | `pending` / `approved` / `rejected` |
| screenshot_url | text | |
| screenshot_hash | text | SHA-256 |
| input_manual | boolean | |
| deleted_at | timestamptz | |

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
- **`active_deposits`** — filtert approved + nicht-deleted

### Supabase Storage
- **Bucket:** `screenshots` — Einzahlungen + Kampfberichte + FCU

---

## 5. RPCs

### Hilfs-Funktionen
```sql
get_my_clan_id() → uuid
get_my_role()    → text
```

### FCU (neu seit V23)
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

### Spec-Dateien
| Datei | Testfälle |
|-------|-----------|
| `auth.spec.ts` | Login, Redirect, Fehlermeldung |
| `navigation.spec.ts` | Drawer, Tab-Sichtbarkeit, Abmelden |
| `home.spec.ts` | Status, Backlog, Schnellzugriff |
| `fcu.spec.ts` | Event anlegen, Upload, Ranking |
| `announcements.spec.ts` | Erstellen, Anpinnen, Löschen |

### Testaccounts
| Account | Rolle |
|---------|-------|
| `autoadmin` | admin |
| `autooffi` | offizier |
| `automitglied` | mitglied |

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

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
