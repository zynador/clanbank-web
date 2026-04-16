# TGM Consigliere — Codestruktur

> **Letzte Aktualisierung:** 16.04.2026 | Fahrplan V46
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
│   │   │       └── route.ts        ← Passwort-Reset (Service Role Key, nur Admin) — email_confirm: true (V45)
│   │   └── demo/
│   │       └── login/
│   │           └── route.ts        ← Demo-Gastaccount erstellen + Session setzen (Service Role Key)
│   ├── dashboard/
│   │   └── page.tsx                ← Haupt-App: Gold Noir Header (zweizeilig), Demo-Banner, Tour-Button in Header (V46)
│   ├── demo/
│   │   └── page.tsx                ← Gold Noir Rollenwahl (Admin/Offizier/Mitglied), Banner analog login/page.tsx (V41)
│   ├── login/
│   │   └── page.tsx                ← TGM Consigliere Banner + Signatur + Demo-Link + "Passwort vergessen?"-Hinweis (V45)
│   ├── register/
│   │   └── page.tsx                ← 4-Schritt-Registrierung: code → credentials → name → success (V43)
│   ├── globals.css                 ← @import "tailwindcss" (Tailwind v4, keine tailwind.config.ts)
│   └── layout.tsx                  ← Title: "TGM Consigliere", Body-Background: #0C0A08 (V40)
├── components/
│   ├── AdminPanel.tsx              ← isDemo-Check; Dropdowns zeigen "Ingame-Name (username)" (V45)
│   ├── AnnouncementWidget.tsx
│   ├── ApprovalQueue.tsx
│   ├── BacklogWidget.tsx
│   ├── BankImportPanel.tsx         ← Historischer Excel-Import (Idee 3)
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── ExemptionModal.tsx
│   ├── FCUEventTab.tsx
│   ├── FCUResultsEditor.tsx
│   ├── FCURankingView.tsx
│   ├── FCUUploadPanel.tsx
│   ├── GuidedTour.tsx              ← Floating Tooltip + Highlight-Ring (NUR Member-Tour, NICHT für Demo)
│   ├── GuidesModal.tsx             ← Props: lang, onClose, isDemo? — erweiterter Markdown-Parser (V46)
│   ├── HelpButton.tsx
│   ├── HistoricalDepositsPanel.tsx
│   ├── HomeTab.tsx                 ← Greeting gold (V46): style={{ color: '#E8C87A' }}
│   ├── InfoTooltip.tsx
│   ├── Logo.tsx                    ← Props: size?: number, className?: string (KEIN variant mehr! V40)
│   ├── MembersTab.tsx
│   ├── PayoutCalculation.tsx
│   ├── ProfileMatchPanel.tsx
│   ├── RankingTab.tsx
│   ├── ScreenshotThumb.tsx
│   ├── ScreenshotUpload.tsx
│   ├── SecurityAlerts.tsx
│   ├── StarterMembersPanel.tsx
│   ├── SuggestionBox.tsx
│   ├── TourButton.tsx              ← Datei bleibt, wird aber NICHT mehr gerendert (V46: Tour via Header-Button)
│   └── WelcomeModal.tsx
├── hooks/
│   └── useExemptions.ts
├── lib/
│   ├── auth-context.tsx            ← useAuth() Hook
│   └── supabaseClient.ts           ← supabase Client (IMMER von hier importieren)
├── public/
│   └── guides/
│       ├── game/
│       │   ├── formationen-de.md / formationen-en.md
│       │   ├── turmkampf-de.md / turmkampf-en.md
│       │   ├── waffen-de.md / waffen-en.md
│       │   ├── t4-de.md / t4-en.md
│       │   ├── spiel-ziele-de.md / spiel-ziele-en.md
│       │   └── leitgedanke-de.md / leitgedanke-en.md
│       └── app/
│           └── einzahlungen-de.md / einzahlungen-en.md  ← inkl. Passwort-FAQ (V46)
├── tests/
│   ├── playwright.config.ts
│   ├── auth.spec.ts
│   ├── navigation.spec.ts
│   ├── home.spec.ts
│   ├── fcu.spec.ts
│   └── announcements.spec.ts
├── tsconfig.json
└── CODESTRUKTUR.md
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
- **KEIN `variant` prop** — entfernt!
- **Gold-Shield:** Gradient `#E8C87A` → `#A87C2A`, Innen `#1C1508` → `#2A1E08`
- **Kein Polygon-Punkt** über dem C

---

### `app/register/page.tsx` (V43)
- **Steps:** `"code"` → `"credentials"` → `"name"` → `"success"`
- **Step credentials:** nur Username + Passwort + Bestätigung; `signUp()` mit `ingameName: username` als Platzhalter
- **fetchStarters():** IMMER nach `signUp()` aufrufen — RLS erfordert authentifizierten User!
- **Step name:** Dropdown aus `starter_members` (status=unclaimed, alphabetisch) + Freitext-Fallback
- **Auto-Switch:** Wenn `starterMembers.length === 0` → automatisch Freitext-Modus
- **updateIngameName():** `supabase.rpc("update_my_ingame_name", { p_ingame_name: resolvedName })` — SECURITY DEFINER RPC
- **SuccessType:** `"claimed"` | `"manual"`
- **Farbregeln:** `goldFaint` nur für Borders/Hintergründe — NIEMALS für Text

---

### `dashboard/page.tsx` (V46)
- **Hintergrund:** `style={{ background: '#0C0A08' }}`
- **Root-div:** `overflowX: 'clip'` — NICHT `overflow-x-hidden` (bricht sticky!)
- **Gold-Konstanten:** `const G = { bg, bg2, bg3, border, borderHi, gold, goldMid, goldLow, goldFaint }`
- **Header:**
  - Zeile 1: Shield + `TGM · Consigliere` + `Camorra Elite [1Ca]` + 🌐 + ☰
  - Zeile 2: Initialen-Avatar + Ingame-Name + Rolle + 📚 + **?** (Tour, nur !isDemo) + 🎬 Demo + 🚪
  - Zeile 3: Aktiver Tab-Indikator
- **Tour:** Header-`?`-Button (Zeile 2) + Drawer `🗺️`. TourButton-FAB wird NICHT mehr gerendert.
- **isDemo:** `const isDemo = !!(profile as unknown as Record<string, unknown>)?.is_test`
- **Demo-Banner:** `bg-teal-700` nur wenn `isDemo=true`

---

### `components/HomeTab.tsx` (V46)
- **Greeting-Farbe:** `style={{ color: '#E8C87A' }}` — NICHT `text-gray-800` (unsichtbar auf dunklem Hintergrund)

---

### `components/GuidesModal.tsx` (V46)
- **Props:** `lang: Lang`, `onClose: () => void`, `isDemo?: boolean`
- **isDemo=true:** `DemoPlaceholder` — Gold Noir Modal
- **isDemo=false/undefined:** Normales Modal mit `GAME_GUIDES` + `APP_GUIDES`
- **GAME_GUIDES:** Formationen, Turmkampf, Waffen, T4, Spiel & Ziele, Leitgedanke #171
- **APP_GUIDES:** einzahlungen (DE+EN)
- **Markdown-Parser (V46):** Blockquotes, Tabellen, Bold, Listen, Links

---

### `AdminPanel.tsx` (V45)
- **isDemo-Check:** Einladungscode ausgeblendet
- **Member Type:** `{ id, username, ingame_name, display_name, is_bank }`
- **memberLabel(m):** `(m.ingame_name || m.display_name) + ' (' + m.username + ')'`

---

### `app/api/admin/reset-password/route.ts` (V45)
- `email_confirm: true` in `updateUserById()` — verhindert Supabase-Bug

---

### `app/login/page.tsx` (V45)
- Banner: Gold-Shield + "The Grand Mafia" + "Consigliere" (Georgia serif)
- `<Logo size={54} />` — kein variant prop
- **Passwort-Hinweis:** `<p>Passwort vergessen? Wende dich an einen R4.</p>`

---

### `app/demo/page.tsx` (V41)
- Banner identisch zu `login/page.tsx`
- Rollenkarten: Gold Noir — bg `#141008`, border `rgba(201,168,76,0.18)`
- Hover-State: `onMouseEnter/onMouseLeave` auf `hoveredRole`

---

## 3. Auth & Rollen (auth-context.tsx)

```typescript
// usernameToEmail: strips non-alphanumeric!
// "Bam bamm" → "bambamm@clanbank.local"
function usernameToEmail(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@clanbank.local"
}
```

| | Admin | Offizier | Mitglied |
|--|-------|----------|---------| 
| Wand der Schande | ✅ | ✅ | ✅ |
| Mitgliederliste | ✅ | ✅ | ❌ |
| AdminPanel | ✅ | ❌ | ❌ |

- Fake-Email: `username@clanbank.local` · Clan-Code: `MAFIA2026`
- Camorra Elite UUID: `00000000-0000-0000-0000-000000000001`
- Demo-Clan UUID: `00000000-0000-0000-0000-000000000002`

---

## 4. Datenbank (Supabase)

### Tabellen
```
profiles          id, username, display_name, ingame_name, role, clan_id, is_bank, is_test, left_clan_at
starter_members   id, ingame_name, display_name, role, status, claimed_by, claimed_at, clan_id, left_clan_at
deposits          id, user_id, clan_id, resource_type(ENUM), amount, status, created_at, deleted_at
historical_deposits  ingame_name, clan_id, resource_type(text!), amount, transferred
fcu_events / fcu_results / battle_reports / member_exemptions / tour_progress / clans
```

### starter_members Status-Werte
```
unclaimed       → Dropdown bei Registrierung
claimed_pending → Spieler hat beantragt, Admin muss bestätigen
confirmed       → Admin hat bestätigt
```

### Wichtige RPCs
```
validate_clan_code(input_code)
register_with_clan_code(input_code, input_username, input_ingame_name)
update_my_ingame_name(p_ingame_name text)   ← SECURITY DEFINER (V43)
get_ranking_data()                           -- kein p_clan_id!
get_fcu_overall_ranking(p_clan_id uuid)
get_security_alerts_count()
get_or_create_tour_progress() / update_tour_progress(p_last_step, p_completed)
import_historical_deposits / save_fcu_results / claim_starter_profile / link_profile_to_starter
confirm_starter_claim / reject_starter_claim / import_starter_members
```

### RLS-Policies auf `profiles`
```
profiles_insert_own        INSERT — with_check: (id = auth.uid())
profiles_select_same_clan  SELECT — qual: (clan_id = get_my_clan_id())
demo_no_update_profile     UPDATE — qual: id <> ALL (Demo-Account-UUIDs)
profiles_update_admin      UPDATE — qual: (clan_id = get_my_clan_id() AND role = 'admin')
profiles_update_own        UPDATE — qual: (id = auth.uid())
```

---

## 5. Key-Patterns

```typescript
// isDemo
const isDemo = !!(profile as unknown as Record<string, unknown>)?.is_test

// Root-div: overflowX clip (NICHT hidden — bricht sticky!)
<div style={{ background: G.bg, color: G.gold, overflowX: 'clip' }}>

// Greeting HomeTab (V46) — goldfarben statt text-gray-800
<p className="text-base font-semibold" style={{ color: '#E8C87A' }}>

// Template Literals VERMEIDEN
// ❌ `Hallo ${name}`   ✅ 'Hallo ' + name

// Logo
// ❌ <Logo variant="large" />   ✅ <Logo size={36} />

// Ingame-Name nach Registrierung (V43)
const { error } = await supabase.rpc('update_my_ingame_name', { p_ingame_name: resolvedName })

// Passwort-Reset (V45) — email_confirm verhindert Supabase-Bug
await adminClient.auth.admin.updateUserById(targetUserId, {
  password: newPassword,
  email_confirm: true,
})

// AdminPanel memberLabel (V45)
function memberLabel(m: Member): string {
  return (m.ingame_name || m.display_name) + ' (' + m.username + ')'
}

// Starter Bulk-Query
const { data: histDeposits } = starterNames.length > 0
  ? await supabase.from('historical_deposits').select('ingame_name, resource_type, amount')
      .eq('clan_id', profile.clan_id).in('ingame_name', starterNames)
  : { data: [] }

// Modal
<div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={close}>
  <div onClick={e => e.stopPropagation()}>...</div>
</div>

// resource_type
paidSet.add(d.user_id + '_' + (d.resource_type as string).toLowerCase() + '_' + kw)
```

---

## 6. Demo-System (Idee 7 — V39, erweitert V41)

1. `/demo` → Gold Noir Rollenwahl → POST `/api/demo/login` → Redirect `/dashboard`
2. `isDemo=true` → Demo-Banner (teal), Tour-Button ausgeblendet, AdminPanel Einladungscode versteckt
3. GuidesModal: `DemoPlaceholder` statt echter Guides
4. Login-Seite: "🎬 App ohne Login erkunden" → `/demo`
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

## 8. App-Guides (V44+)

Ablage: `public/guides/` als statische Markdown-Dateien (Vercel). Benennung: `[thema]-de.md` / `[thema]-en.md`.

### Fertige Guides

| Thema | Dateien | Inhalt |
|---|---|---|
| Einzahlungen & Auszahlungen | `app/einzahlungen-de.md` / `einzahlungen-en.md` | 12 Abschnitte + Passwort-FAQ (V46) |

### Geplante Guides
1. FCU Events (`fcu-de.md` / `fcu-en.md`)
2. Kampfberichte (`kampfberichte-de.md` / `kampfberichte-en.md`)
3. Profil & Status (`profil-de.md` / `profil-en.md`)
4. Erste Schritte in der App (`erste-schritte-de.md` / `erste-schritte-en.md`)

### Regelwerk Einzahlungen
- Wöchentliche Mindesteinzahlung: **5 Mio × 5 Ressourcen**
- Formel `(aktuelle KW − Beitritts-KW) × 5 Mio` = Einzahlungsstand
- Screenshots max. **4 Tage alt**; ohne Screenshot keine Anerkennung
- Auszahlung: ≥ 10.000 verletzte T4+ (keine Toten)
- Sätze: 2,4 Mio / 10k (Cash/Arms/Cargo/Metall), 1,2 Mio / 10k (Diamanten)
- Raidleiter: Einzahlungspflicht befreit, doppelte Auszahlung

---

## 9. Bekannte Fallstricke

| Problem | Lösung |
|---------|--------|
| `search_path`-Fehler bei RPCs | `SET search_path = public` |
| profiles kein `deleted_at` | Soft-Delete via `left_clan_at` |
| resource_type ENUM grossgeschrieben | `.toLowerCase()` in JS |
| historical_deposits resource_type | plain text, kein ENUM |
| get_ranking_data kein p_clan_id | nutzt `get_my_clan_id()` intern |
| `Logo variant` prop | existiert nicht (V40) — nur `size` + `className` |
| Template Literals in JSX | String-Konkatenation |
| lucide-react nicht installiert | Emojis verwenden |
| Gold Noir bg via Tailwind | `style={{ background: G.bg }}` statt Tailwind-Class |
| **`overflow-x-hidden` bricht sticky Header** | **`overflowX: 'clip'` auf Root-div (V46)** |
| **Tailwind `text-gray-*` auf dunklem Hintergrund** | **`style={{ color: '#E8C87A' }}` — gray-* fast unsichtbar auf #0C0A08 (V46)** |
| Demo-Banner nicht sichtbar | `is_test`-Flag via isDemo-Pattern prüfen |
| Modal blockiert Playwright | `div.fixed.inset-0.z-50` |
| GuidesModal zeigt echte Guides in Demo | `isDemo={isDemo}` prop übergeben |
| starter_members Dropdown leer | fetchStarters() NACH signUp() — RLS! |
| Hinweistexte zu dunkel | goldFaint nur für Borders — Text min. goldLow |
| ingame_name Update bei Registrierung | RPC `update_my_ingame_name` statt direktem .update() |
| Passwort-Reset: Login schlägt fehl | `email_confirm: true` in updateUserById() |
| AdminPanel: falscher Username bei Reset | `memberLabel()` zeigt "Ingame-Name (username)" |
| Login-Username ≠ Ingame-Name | usernameToEmail() stripped non-alphanumeric |
| GitHub Repo noch öffentlich | Nach Feature-Abschluss auf privat |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
