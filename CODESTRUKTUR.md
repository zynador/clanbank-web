# TGM Consigliere — Codestruktur

> **Letzte Aktualisierung:** 13.04.2026 | Fahrplan V41
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)

```
clanbank-web/
├── .github/
│   └── workflows/
│       └── playwright.yml          ← GitHub Actions E2E-Tests (manuell via workflow_dispatch, Node.js 22)
├── app/
│   ├── api/
│   │   ├── ocr/
│   │   │   └── route.ts            ← Claude Haiku Vision OCR (alle Modi)
│   │   ├── admin/
│   │   │   └── reset-password/
│   │   │       └── route.ts        ← Passwort-Reset (Service Role Key, nur Admin)
│   │   └── demo/
│   │       └── login/
│   │           └── route.ts        ← Demo-Gastaccount erstellen + Session setzen (Service Role Key)
│   ├── dashboard/
│   │   └── page.tsx                ← Haupt-App: Gold Noir Header (zweizeilig), Demo-Banner, Tour
│   ├── demo/
│   │   └── page.tsx                ← Gold Noir Rollenwahl (Admin/Offizier/Mitglied → /api/demo/login), Banner analog login/page.tsx (V41)
│   ├── login/
│   │   └── page.tsx                ← TGM Consigliere Banner + Signatur + Demo-Link "App ohne Login erkunden" (V41)
│   ├── register/
│   │   └── page.tsx                ← 4-Schritt-Registrierung (Gold Noir Styling, V40)
│   ├── globals.css                 ← @import "tailwindcss" (Tailwind v4, keine tailwind.config.ts)
│   └── layout.tsx                  ← Title: "TGM Consigliere", Body-Background: #0C0A08 (V40)
├── components/
│   ├── AdminPanel.tsx              ← isDemo-Check: Einladungscode ausgeblendet für Demo-User
│   ├── AnnouncementWidget.tsx      ← Admin-Ankündigungen (erstellen/löschen/anpinnen)
│   ├── ApprovalQueue.tsx
│   ├── BacklogWidget.tsx
│   ├── BankImportPanel.tsx         ← Historischer Excel-Import (Idee 3)
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── ExemptionModal.tsx
│   ├── FCUEventTab.tsx             ← FCU Haupt-Container (Event-Liste, Navigation)
│   ├── FCUResultsEditor.tsx        ← OCR-Ergebnisse prüfen, Namen korrigieren, speichern
│   ├── FCURankingView.tsx          ← Gesamtranking über alle FCU Events
│   ├── FCUUploadPanel.tsx          ← Multi-Screenshot Upload + OCR pro Screen
│   ├── GuidedTour.tsx              ← Floating Tooltip + Highlight-Ring (NUR Member-Tour, NICHT für Demo)
│   ├── GuidesModal.tsx             ← Props: lang, onClose, isDemo? — isDemo=true → DemoPlaceholder (V41)
│   ├── HelpButton.tsx
│   ├── HistoricalDepositsPanel.tsx ← Admin: Status aller historical_deposits
│   ├── HomeTab.tsx                 ← Startseite (Status, Backlog, Ankündigungen, Doppel-Podest Ranking)
│   ├── InfoTooltip.tsx
│   ├── Logo.tsx                    ← Props: size?: number, className?: string (KEIN variant mehr! V40)
│   ├── MembersTab.tsx              ← Mitgliederliste (Suchfeld, Filter, kompaktes Karten-Layout)
│   ├── PayoutCalculation.tsx
│   ├── ProfileMatchPanel.tsx       ← Fuzzy-Matching ungematchter Profile mit Starter-Einträgen
│   ├── RankingTab.tsx
│   ├── ScreenshotThumb.tsx
│   ├── ScreenshotUpload.tsx
│   ├── SecurityAlerts.tsx
│   ├── StarterMembersPanel.tsx
│   ├── SuggestionBox.tsx
│   ├── TourButton.tsx              ← Schwebender ? Button unten rechts (Member-Tour Trigger, nur wenn !isDemo)
│   └── WelcomeModal.tsx
├── hooks/
│   └── useExemptions.ts            ← Custom Hook für member_exemptions
├── lib/
│   ├── auth-context.tsx            ← useAuth() Hook
│   └── supabaseClient.ts           ← supabase Client (IMMER von hier importieren)
├── public/
│   └── guides/                     ← Guides als Markdown (Vercel static)
│       ├── game/
│       │   ├── formationen-de.md / formationen-en.md
│       │   ├── turmkampf-de.md / turmkampf-en.md
│       │   ├── waffen-de.md / waffen-en.md
│       │   ├── t4-de.md / t4-en.md
│       │   ├── spiel-ziele-de.md / spiel-ziele-en.md
│       │   └── leitgedanke-de.md / leitgedanke-en.md
│       └── app/                    ← App-Guides (noch leer, vorbereitet)
├── tests/
│   ├── playwright.config.ts
│   ├── auth.spec.ts
│   ├── navigation.spec.ts
│   ├── home.spec.ts
│   ├── fcu.spec.ts
│   └── announcements.spec.ts
├── tsconfig.json                   ← exclude: ["node_modules", "tests"]
└── CODESTRUKTUR.md                 ← diese Datei
```

---

## 2. Komponenten

### Pflicht-Imports (immer so, nie anders)

```typescript
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
```

### Typ-Definitionen (global)

```typescript
type Lang = 'de' | 'en'
type UserRole = 'admin' | 'offizier' | 'mitglied'
```

---

### `Logo.tsx` (V40)

- **Props:** `size?: number` (Default: 38), `className?: string`
- **KEIN `variant` prop** — `variant="large"/"small"/"favicon"` entfernt!
- **Gold-Shield:** Gradient `#E8C87A` → `#A87C2A`, Innen `#1C1508` → `#2A1E08`
- **Kein Polygon-Punkt** über dem C
- Verwendung: `<Logo />` oder `<Logo size={34} />`

---

### `dashboard/page.tsx` (V41)

- **Hintergrund:** `style={{ background: '#0C0A08' }}`
- **Gold-Konstanten:** `const G = { bg, bg2, bg3, border, borderHi, gold, goldMid, goldLow, goldFaint }`
- **Header zweizeilig:**
  - Zeile 1: Shield + `TGM · Consigliere` + `Camorra Elite [1Ca]` + 🌐 + ☰
  - Zeile 2: Initialen-Avatar + Ingame-Name + Rolle + 📚 + 🎬 Demo + 🚪
  - Zeile 3: Aktiver Tab-Indikator
- **isDemo:** `const isDemo = !!(profile as unknown as Record<string, unknown>)?.is_test`
- **Demo-Banner:** `bg-teal-700` bleibt teal, nur wenn `isDemo=true`
- **GuidesModal:** `<GuidesModal lang={lang} onClose={...} isDemo={isDemo} />` (V41)
- **Tour:** `checkAndStartTour()` nach `handleWelcomeClose()`. Demo-User: `if (isDemo) return`
- **TourButton:** Nur wenn `!isDemo && !showTour`

---

### `app/login/page.tsx` (V41)

- Banner: Gold-Shield + "The Grand Mafia" + "Consigliere" (Georgia serif) + Divider + Tagline
- Signatur: "powered by" + "Camorra Elite [1Ca]" + "Eurer Vicar" (kursiv)
- `<Logo size={54} />` — kein variant prop
- **Footer (V41):** "Noch kein Konto? Registrieren" + Separator (0.5px gold) + "🎬 App ohne Login erkunden" → `/demo`

---

### `app/demo/page.tsx` (V41)

- **Banner:** Identisch zu `login/page.tsx` (`<Logo size={54} />`, "The Grand Mafia", "Consigliere" Georgia, Divider, Signatur)
- **Tagline:** "Entdecke TGM Consigliere — kein Login, kein Code."
- **Rollenkarten:** Gold Noir — bg `#141008`, border `rgba(201,168,76,0.18)`, Hover `rgba(201,168,76,0.08)`
- **Feature-Checkmarks:** `#C9A84C`, **Rollen-Labels:** `#E8C87A`
- **Laden-Spinner:** Gold `#C9A84C` via `@keyframes spin` + Inline-`<style>`
- **Seitencontainer:** `#0C0A08`, **Footer-Link:** `rgba(201,168,76,0.6)` → `/login`
- **Hover-State:** `onMouseEnter/onMouseLeave` auf `hoveredRole`

---

### `components/GuidesModal.tsx` (V41)

- **Props:** `lang: Lang`, `onClose: () => void`, `isDemo?: boolean`
- **isDemo=true:** Rendert `DemoPlaceholder` — Gold Noir Modal mit Hinweis auf clan-spezifische Guides
- **isDemo=false/undefined:** Normales Modal mit `GAME_GUIDES` + `APP_GUIDES`
- **GAME_GUIDES:** Formationen, Turmkampf, Waffen, T4, Spiel & Ziele, Leitgedanke #171 (alle 6 erhalten)
- **DemoPlaceholder-Text:** "Hier können clan-spezifische Guides hochgeladen werden — von Spielstrategien bis zu App-Anleitungen. Im Live-Betrieb steht hier das Wissen eures Clans."

---

### `app/register/page.tsx` (V40)

- Gold Noir Styling, `<Logo size={48} />`
- Success: "Willkommen bei TGM Consigliere!"

---

### `app/layout.tsx` (V40)

- Title: `"TGM Consigliere"`
- Body: `style={{ background: '#0C0A08', color: '#E8C87A' }}`

---

### `AdminPanel.tsx`

- **isDemo:** `const { user, profile } = useAuth()` + isDemo-Check
- Einladungscode ausgeblendet für Demo-User

---

### `HomeTab.tsx` (V40)

- **statusOk:** `'TGM Consigliere: Du bist auf dem Laufenden'`
- **statusBehind:** `'TGM Consigliere: Du bist im Rückstand!'`
- Wand der Schande Modal: `fixed inset-0 z-50`
- paidSet: IMMER `.toLowerCase()` auf resource_type

---

## 3. Gold Noir Design-System (V40)

```typescript
const G = {
  bg:        '#0C0A08',
  bg2:       '#141008',
  bg3:       '#1C1508',
  border:    'rgba(201,168,76,0.18)',
  borderHi:  'rgba(201,168,76,0.35)',
  gold:      '#E8C87A',
  goldMid:   'rgba(201,168,76,0.55)',
  goldLow:   'rgba(201,168,76,0.3)',
  goldFaint: 'rgba(201,168,76,0.15)',
}
```

### Header-Struktur Mobile-first

```
Z1: [Shield] [TGM · Consigliere / Camorra Elite [1Ca]] [🌐][☰]
Z2: [VI] [Vicar] [ADMIN] [📚][🎬 Demo][🚪]
Z3: [🏠 Home]
```

---

## 4. Supabase Schema (Auszug)

```
profiles       id, username, ingame_name, role, clan_id, is_raidleiter, is_test, is_bank, left_clan_at
starter_members id, ingame_name, clan_id, status, claimed_by, left_clan_at
deposits       id, user_id, clan_id, resource_type(ENUM), amount, status, created_at, deleted_at
historical_deposits ingame_name, clan_id, resource_type(text!), amount, transferred
fcu_events / fcu_results / battle_reports / member_exemptions / tour_progress / clans
```

### Wichtige RPCs

```
validate_clan_code(input_code)
get_ranking_data()                              -- kein p_clan_id!
get_fcu_overall_ranking(p_clan_id uuid)
get_security_alerts_count()
get_or_create_tour_progress() / update_tour_progress(p_last_step, p_completed)
import_historical_deposits / save_fcu_results / claim_starter_profile / link_profile_to_starter
```

---

## 5. Key-Patterns

```typescript
// isDemo
const isDemo = !!(profile as unknown as Record<string, unknown>)?.is_test

// GuidesModal mit isDemo
{showGuides && <GuidesModal lang={lang} onClose={() => setShowGuides(false)} isDemo={isDemo} />}

// resource_type
paidSet.add(d.user_id + '_' + (d.resource_type as string).toLowerCase() + '_' + kw)

// Starter Bulk-Query
const { data: histDeposits } = starterNames.length > 0
  ? await supabase.from('historical_deposits').select('ingame_name, resource_type, amount')
      .eq('clan_id', profile.clan_id).in('ingame_name', starterNames)
  : { data: [] }

// Modal
<div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={close}>
  <div onClick={e => e.stopPropagation()}>...</div>
</div>

// Template Literals VERMEIDEN
// ❌ `Hallo ${name}`   ✅ 'Hallo ' + name

// Logo
// ❌ <Logo variant="large" />   ✅ <Logo size={36} />
```

---

## 6. Demo-System (Idee 7 — V39, erweitert V41)

1. `/demo` → Gold Noir Rollenwahl → POST `/api/demo/login` → Redirect `/dashboard`
2. `isDemo=true` → Demo-Banner (teal), Tour ausgeblendet, AdminPanel Einladungscode versteckt
3. GuidesModal: `DemoPlaceholder` statt echter Guides (clan-Inhalte geschützt)
4. Login-Seite: "🎬 App ohne Login erkunden" → `/demo` (direkt sichtbar für Besucher)
5. Demo-Clan-UUID: `00000000-0000-0000-0000-000000000002`

---

## 7. Playwright E2E-Tests — Stand V39: 29/29 grün

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
// Accounts: autoadmin/admin123, autooffi/offi123, automitglied/mitglied123
```

---

## 8. Auth & Rollen

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------| 
| Wand der Schande | ✅ | ✅ | ✅ |
| Mitgliederliste | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |

- Fake-Email: `username@clanbank.local` · Clan-Code: `MAFIA2026`
- Camorra Elite UUID: `00000000-0000-0000-0000-000000000001`
- Demo-Clan UUID: `00000000-0000-0000-0000-000000000002`

---

## 9. Bekannte Fallstricke

| Problem | Lösung |
|---------|--------|
| `search_path`-Fehler bei RPCs | `SET search_path = public` |
| profiles kein `deleted_at` | Soft-Delete via `left_clan_at` |
| resource_type ENUM grossgeschrieben | `.toLowerCase()` in JS |
| historical_deposits resource_type | plain text, kein ENUM |
| get_ranking_data kein p_clan_id | nutzt `get_my_clan_id()` intern |
| `Logo variant` prop | existiert nicht mehr (V40) — nur `size` + `className` |
| Template Literals in JSX | String-Konkatenation |
| lucide-react nicht installiert | Emojis verwenden |
| Gold Noir bg via Tailwind | Inline `style={{ background: G.bg }}` statt Tailwind-Class |
| Demo-Banner nicht sichtbar | `is_test`-Flag via isDemo-Pattern prüfen |
| Modal blockiert Playwright | `div.fixed.inset-0.z-50` |
| GuidesModal zeigt echte Guides in Demo | `isDemo={isDemo}` prop übergeben (V41) |
| GitHub Repo noch öffentlich | Nach Feature-Abschluss auf privat |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
