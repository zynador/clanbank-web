# TGM Consigliere — Codestruktur

> **Letzte Aktualisierung:** 15.04.2026 | Fahrplan V45
> **Raw-URL für neue Chat-Sessions:**
> `https://raw.githubusercontent.com/zynador/clanbank-web/main/CODESTRUKTUR.md`

---

## 1. Projektstruktur (Verzeichnisse)

```
clanbank-web/
├── .github/
│   └── workflows/
│       └── playwright.yml         ← GitHub Actions E2E-Tests (manuell via workflow_dispatch, Node.js 22)
├── app/
│   ├── api/
│   │   ├── ocr/
│   │   │   └── route.ts           ← Claude Haiku Vision OCR (alle Modi)
│   │   ├── admin/
│   │   │   └── reset-password/
│   │   │       └── route.ts       ← Passwort-Reset (Service Role Key, nur Admin) — email_confirm: true (V45)
│   │   └── demo/
│   │       └── login/
│   │           └── route.ts       ← Demo-Gastaccount erstellen + Session setzen (Service Role Key)
│   ├── dashboard/
│   │   └── page.tsx               ← Haupt-App: Gold Noir Header (zweizeilig), Demo-Banner, Tour
│   ├── demo/
│   │   └── page.tsx               ← Gold Noir Rollenwahl (Admin/Offizier/Mitglied → /api/demo/login), Banner analog login/page.tsx (V41)
│   ├── login/
│   │   └── page.tsx               ← TGM Consigliere Banner + Signatur + Demo-Link + "Passwort vergessen?"-Hinweis (V45)
│   ├── register/
│   │   └── page.tsx               ← 4-Schritt-Registrierung: code → credentials → name → success (V43)
│   ├── globals.css                ← @import "tailwindcss" (Tailwind v4, keine tailwind.config.ts)
│   └── layout.tsx                 ← Title: "TGM Consigliere", Body-Background: #0C0A08 (V40)
├── components/
│   ├── AdminPanel.tsx             ← isDemo-Check; Dropdowns zeigen "Ingame-Name (username)" (V45)
│   ├── AnnouncementWidget.tsx     ← Admin-Ankündigungen (erstellen/löschen/anpinnen)
│   ├── ApprovalQueue.tsx
│   ├── BacklogWidget.tsx
│   ├── BankImportPanel.tsx        ← Historischer Excel-Import (Idee 3)
│   ├── BattleReportUpload.tsx
│   ├── DepositsTab.tsx
│   ├── ExemptionBadge.tsx
│   ├── ExemptionModal.tsx
│   ├── FCUEventTab.tsx            ← FCU Haupt-Container (Event-Liste, Navigation)
│   ├── FCUResultsEditor.tsx       ← OCR-Ergebnisse prüfen, Namen korrigieren, speichern
│   ├── FCURankingView.tsx         ← Gesamtranking über alle FCU Events
│   ├── FCUUploadPanel.tsx         ← Multi-Screenshot Upload + OCR pro Screen
│   ├── GuidedTour.tsx             ← Floating Tooltip + Highlight-Ring (NUR Member-Tour, NICHT für Demo)
│   ├── GuidesModal.tsx            ← Props: lang, onClose, isDemo? — isDemo=true → DemoPlaceholder (V41)
│   ├── HelpButton.tsx
│   ├── HistoricalDepositsPanel.tsx ← Admin: Status aller historical_deposits
│   ├── HomeTab.tsx                ← Startseite (Status, Backlog, Ankündigungen, Doppel-Podest Ranking)
│   ├── InfoTooltip.tsx
│   ├── Logo.tsx                   ← Props: size?: number, className?: string (KEIN variant mehr! V40)
│   ├── MembersTab.tsx             ← Mitgliederliste (Suchfeld, Filter, kompaktes Karten-Layout)
│   ├── PayoutCalculation.tsx
│   ├── ProfileMatchPanel.tsx      ← Fuzzy-Matching ungematchter Profile mit Starter-Einträgen
│   ├── RankingTab.tsx
│   ├── ScreenshotThumb.tsx
│   ├── ScreenshotUpload.tsx
│   ├── SecurityAlerts.tsx
│   ├── StarterMembersPanel.tsx
│   ├── SuggestionBox.tsx
│   ├── TourButton.tsx             ← Schwebender ? Button unten rechts (Member-Tour Trigger, nur wenn !isDemo)
│   └── WelcomeModal.tsx
├── hooks/
│   └── useExemptions.ts           ← Custom Hook für member_exemptions
├── lib/
│   ├── auth-context.tsx           ← useAuth() Hook
│   └── supabaseClient.ts          ← supabase Client (IMMER von hier importieren)
├── public/
│   └── guides/                    ← Guides als Markdown (Vercel static)
│       ├── game/
│       │   ├── formationen-de.md / formationen-en.md
│       │   ├── turmkampf-de.md / turmkampf-en.md
│       │   ├── waffen-de.md / waffen-en.md
│       │   ├── t4-de.md / t4-en.md
│       │   ├── spiel-ziele-de.md / spiel-ziele-en.md
│       │   └── leitgedanke-de.md / leitgedanke-en.md
│       └── app/                   ← App-Guides (V44)
│           └── einzahlungen-de.md / einzahlungen-en.md
├── tests/
│   ├── playwright.config.ts
│   ├── auth.spec.ts
│   ├── navigation.spec.ts
│   ├── home.spec.ts
│   ├── fcu.spec.ts
│   └── announcements.spec.ts
├── tsconfig.json                  ← exclude: ["node_modules", "tests"]
└── CODESTRUKTUR.md                ← diese Datei
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

### `app/register/page.tsx` (V43)
- **Steps:** `"code"` → `"credentials"` → `"name"` → `"success"`
- **Kein Anzeigename-Feld** — entfernt (kein DB-Gegenstück)
- **Kein Ingame-Name Freitext** in Step credentials — wird in Step name gesetzt
- **Step credentials:** nur Username + Passwort + Bestätigung; `signUp()` mit `ingameName: username` als Platzhalter
- **fetchStarters():** IMMER nach `signUp()` aufrufen — RLS erfordert authentifizierten User!
- **Step name:** Dropdown aus `starter_members` (status=unclaimed, alphabetisch) + "Mein Name steht nicht in der Liste" → Freitext + Admin-Hinweis
- **Auto-Switch:** Wenn `starterMembers.length === 0` → automatisch Freitext-Modus
- **updateIngameName():** `supabase.rpc("update_my_ingame_name", { p_ingame_name: resolvedName })` — SECURITY DEFINER RPC (V43), kein `getUser()` nötig, mit `console.error`-Logging
- **claim_starter_profile:** wird bei Listen-Auswahl automatisch aufgerufen (kein separater Schritt sichtbar)
- **SuccessType:** `"claimed"` (Dropdown + Claim OK) | `"manual"` (Freitext oder Claim fehlgeschlagen)
- **Farbregeln:** `goldFaint` nur für Borders/Hintergründe — NIEMALS für Text

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

### `app/login/page.tsx` (V45)
- Banner: Gold-Shield + "The Grand Mafia" + "Consigliere" (Georgia serif) + Divider + Tagline
- Signatur: "powered by" + "Camorra Elite [1Ca]" + "Eurer Vicar" (kursiv)
- `<Logo size={54} />` — kein variant prop
- **Footer (V41):** "Noch kein Konto? Registrieren" + Separator (0.5px gold) + "🎬 App ohne Login erkunden" → `/demo`
- **Passwort-Hinweis (V45):** `<p>Passwort vergessen? Wende dich an einen R4.</p>` — ganz unten im Footer

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
- **APP_GUIDES:** einzahlungen (DE+EN) — weitere folgen (V44)

---

### `AdminPanel.tsx` (V45)
- **isDemo-Check:** Einladungscode ausgeblendet für Demo-User
- **Member Type:** `{ id, username, ingame_name, display_name, is_bank }` — `username` neu (V45)
- **loadMembers():** `.select('id, username, ingame_name, display_name, is_bank')` — `username` neu (V45)
- **memberLabel(m):** Hilfsfunktion → `(m.ingame_name || m.display_name) + ' (' + m.username + ')'`
- **Beide Dropdowns** (Passwort-Reset + Bank-Toggle) nutzen `memberLabel()` (V45)

---

### `app/api/admin/reset-password/route.ts` (V45)
- **Caller-Verifizierung:** `get_my_role()` → nur `admin`
- **Service Role Key:** `adminClient.auth.admin.updateUserById(targetUserId, { password, email_confirm: true })`
- **`email_confirm: true`** (V45): Verhindert dass Supabase nach dem Passwort-Reset den E-Mail-Status zurücksetzt (war Bug: alter + neuer Login schlug fehl)

---

## 3. Auth & Rollen (auth-context.tsx)

```typescript
// usernameToEmail: strips non-alphanumeric!
// "Bam bamm" → "bambamm@clanbank.local"
// Login-Username ≠ Ingame-Name
function usernameToEmail(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@clanbank.local"
}
```

|                  | Admin | Offizier | Mitglied |
|--|-------|----------|---------| 
| Wand der Schande | ✅ | ✅ | ✅ |
| Mitgliederliste  | ✅ | ✅ | ❌ |
| AdminPanel       | ✅ | ❌ | ❌ |

- Fake-Email: `username@clanbank.local` · Clan-Code: `MAFIA2026`
- Camorra Elite UUID: `00000000-0000-0000-0000-000000000001`
- Demo-Clan UUID: `00000000-0000-0000-0000-000000000002`

---

## 4. Datenbank (Supabase)

### Tabellen
```
profiles           id, username, display_name, ingame_name, role, clan_id, is_bank, is_test, left_clan_at
starter_members    id, ingame_name, display_name, role, status, claimed_by, claimed_at, clan_id, left_clan_at
deposits           id, user_id, clan_id, resource_type(ENUM), amount, status, created_at, deleted_at
historical_deposits ingame_name, clan_id, resource_type(text!), amount, transferred
fcu_events / fcu_results / battle_reports / member_exemptions / tour_progress / clans
```

### starter_members Status-Werte
```
unclaimed       → noch nicht beansprucht (sichtbar im Dropdown bei Registrierung)
claimed_pending → Spieler hat beantragt, Admin muss bestätigen
confirmed       → Admin hat bestätigt
```

### Wichtige RPCs
```
validate_clan_code(input_code)
register_with_clan_code(input_code, input_username, input_ingame_name)
update_my_ingame_name(p_ingame_name text)              ← V43: SECURITY DEFINER, setzt profiles.ingame_name für auth.uid()
get_ranking_data()                                     -- kein p_clan_id!
get_fcu_overall_ranking(p_clan_id uuid)
get_security_alerts_count()
get_or_create_tour_progress() / update_tour_progress(p_last_step, p_completed)
import_historical_deposits / save_fcu_results / claim_starter_profile / link_profile_to_starter
confirm_starter_claim / reject_starter_claim / import_starter_members
```

### RLS-Policies auf `profiles` (geprüft V43)
```
profiles_insert_own          INSERT  — with_check: (id = auth.uid())
profiles_select_same_clan    SELECT  — qual: (clan_id = get_my_clan_id())
demo_no_update_profile       UPDATE  — qual: id <> ALL (Demo-Account-UUIDs)
profiles_update_admin        UPDATE  — qual: (clan_id = get_my_clan_id() AND role = 'admin')
profiles_update_own          UPDATE  — qual: (id = auth.uid())
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

// Ingame-Name nach Registrierung setzen (V43)
const { error } = await supabase.rpc('update_my_ingame_name', { p_ingame_name: resolvedName })
if (error) console.error('update_my_ingame_name Fehler:', error.message)

// starter_members Fetch — NUR nach signUp() (RLS!)
// ❌ vor signUp: gibt leere Liste zurück (anon = kein Zugriff)
// ✅ nach signUp: User authentifiziert, RLS erlaubt SELECT

// AdminPanel memberLabel (V45)
function memberLabel(m: Member): string {
  return (m.ingame_name || m.display_name) + ' (' + m.username + ')'
}

// Passwort-Reset (V45) — email_confirm: true verhindert Supabase-Bug
await adminClient.auth.admin.updateUserById(targetUserId, {
  password: newPassword,
  email_confirm: true,
})
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

|                  | Admin | Offizier | Mitglied |
|--|-------|----------|---------| 
| Wand der Schande | ✅ | ✅ | ✅ |
| Mitgliederliste  | ✅ | ✅ | ❌ |
| AdminPanel       | ✅ | ❌ | ❌ |

- Fake-Email: `username@clanbank.local` · Clan-Code: `MAFIA2026`
- Camorra Elite UUID: `00000000-0000-0000-0000-000000000001`
- Demo-Clan UUID: `00000000-0000-0000-0000-000000000002`

---

## 9. App-Guides (V44)

Guides liegen unter `public/guides/` als statische Markdown-Dateien (Vercel).
Benennungskonvention: `[thema]-de.md` / `[thema]-en.md`

### Fertige Guides

| Thema | Dateien | Inhalt |
|---|---|---|
| Einzahlungen & Auszahlungen | `app/einzahlungen-de.md` / `einzahlungen-en.md` | 12 Abschnitte: Einzahlsystem, Screenshots, Auszahlung, Raidleiter, FAQ |

### Regelwerk Einzahlungen (festgehalten für künftige Guides)
- Wöchentliche Mindesteinzahlung: **5 Mio × 5 Ressourcen** (fix, kein steigender Betrag)
- Formel `(aktuelle KW − Beitritts-KW) × 5 Mio` = interner Einzahlungsstand (Auszahlungsberechtigung)
- Screenshots max. **4 Tage alt**; ohne Screenshot keine Anerkennung
- Manuelle Eingaben → immer Offizier-Queue (auch mit Screenshot)
- Ausnahmen: kein App-Button → Mitglied meldet sich bei R4, der trägt es ein
- Auszahlung: ≥ 10.000 verletzte T4+ (keine Toten), Einzahlungsstand ok
- Sätze: 2,4 Mio / 10k (Cash/Arms/Cargo/Metall), 1,2 Mio / 10k (Diamanten) — je nach Truppenart
- Nur Raidleiter laden Kampfberichte hoch
- Raidleiter: von Einzahlungspflicht befreit, doppelte Auszahlung, Mindestverlust gilt trotzdem
- Truppenbezeichnungen EN: Messer = Bruiser, Schützen = Hitmen

### Geplante nächste Guides
1. FCU Events (`fcu-de.md` / `fcu-en.md`)
2. Kampfberichte (`kampfberichte-de.md` / `kampfberichte-en.md`)
3. Profil & Status (`profil-de.md` / `profil-en.md`)
4. Erste Schritte in der App (`erste-schritte-de.md` / `erste-schritte-en.md`)

---

## 10. Bekannte Fallstricke

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
| starter_members Dropdown leer | fetchStarters() NACH signUp() aufrufen — RLS! (V42) |
| Hinweistexte zu dunkel | goldFaint (15%) nur für Borders — Text min. goldLow (30%) (V42) |
| ingame_name Update bei Registrierung | RPC `update_my_ingame_name` statt direktem .update() (V43) |
| Passwort-Reset: Login schlägt fehl | `email_confirm: true` in updateUserById() (V45) |
| AdminPanel: falscher Username bei Reset | Dropdown zeigt jetzt "Ingame-Name (username)" via memberLabel() (V45) |
| Login-Username ≠ Ingame-Name | usernameToEmail() stripped non-alphanumeric — "Bam bamm" → "bambamm" |
| GitHub Repo noch öffentlich | Nach Feature-Abschluss auf privat |

---

*Dieses Dokument wird am Ende jeder Feature-Session aktualisiert.*
*Für neue Chat-Sessions: Raw-URL oben einfügen — Claude hat sofort vollen Kontext.*
