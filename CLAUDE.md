# CLAUDE.md

Dieses Dokument definiert verbindliche Regeln für alle Code-Beiträge in diesem Projekt.

---

## Session-Ablauf

### Erst prüfen und testen — dann dokumentieren

Nach jeder Änderung gilt zwingend folgende Reihenfolge:

1. **Code lesen** — betroffene Dateien vollständig sichten bevor etwas geändert wird
2. **Änderung umsetzen** — vollständige Datei liefern, in GitHub einspielen
3. **Testen** — Vercel-Deploy abwarten, im Browser prüfen, ggf. Konsole/Logs checken
4. **Gemeinsam bestätigen** — der Nutzer meldet das Testergebnis (Screenshot oder kurze Rückmeldung), Claude bestätigt. Erst wenn beide einig sind dass alles funktioniert, gilt eine Änderung als abgeschlossen.
5. **Erst dann** Fahrplan und CODESTRUKTUR.md aktualisieren

Fahrplan und CODESTRUKTUR.md werden **nicht sofort** nach einer Änderung erstellt — nur wenn der Nutzer explizit danach fragt oder die Session abgeschlossen ist.

---

## Code Style

### TypeScript strict mode

`strict: true` ist in `tsconfig.json` aktiviert. Alle neuen Dateien müssen damit fehlerfrei kompilieren.

### Keine `any`-Types

Explizites `any` ist verboten — auch dort wo der Compiler es erlauben würde.

```typescript
// ❌
const data: any = await supabase.rpc('my_rpc')
function process(input: any) { ... }

// ✅
const { data, error } = await supabase.rpc<MyResult>('my_rpc')
function process(input: unknown) { ... }
```

Erlaubte Alternativen: `unknown` + Type Guard, konkretes Interface, generischer Typ.

### Funktionen unter 30 Zeilen

Jede Funktion — Handler, Hook, Hilfsfunktion — bleibt unter 30 Zeilen. Größere Logik wird in benannte Hilfsfunktionen aufgeteilt. Diese Regel gilt für **einzelne Funktionen**, nicht für die Dateilänge insgesamt.

```typescript
// ❌ handleSave() mit 60 Zeilen

// ✅ Aufgeteilt:
function validateForm(fields: FormFields): boolean { ... }
async function uploadFile(file: File): Promise<string> { ... }
async function callRpc(url: string): Promise<RpcResult> { ... }

async function handleSave() {
  if (!validateForm(fields)) return
  const url = await uploadFile(file)
  await callRpc(url)
}
```

### Vollständige Dateien — keine Snippets

Jede Änderung wird als **vollständige Datei** geliefert. Niemals nur `str_replace`-Snippets oder Teiländerungen als Lieferobjekt — der Nutzer spielt immer die komplette Datei in GitHub ein.

```
// ❌ "Ersetze Zeile 47 durch..."
// ✅ Komplette Datei mit allen Änderungen integriert
```

### Kein `lucide-react`

Das Paket `lucide-react` ist nicht installiert und darf nicht verwendet werden. Stattdessen: Emojis oder Unicode-Zeichen direkt im JSX.

```typescript
// ❌ import { AlertCircle } from 'lucide-react'
// ✅ <span>⚠️</span>  oder  {'⚠️ ' + text}
```

### Template Literals vermeiden (Turbopack)

Template Literals (`` `${x}` ``) innerhalb von JSX können unter Turbopack zu Parse-Fehlern führen. Stattdessen String-Konkatenation verwenden.

```typescript
// ❌ const label = `Hallo ${name}`  ← in JSX problematisch
// ✅ const label = 'Hallo ' + name
```

Außerhalb von JSX (z. B. in reinen `.ts`-Hilfsfunktionen) sind Template Literals unbedenklich.

### Tests für jeden neuen `app/api/`-Endpunkt

Für jede neue Route unter `app/api/` wird ein Playwright-Testfall in der passenden Spec-Datei ergänzt. Bestehende Spec-Dateien sind in `tests/`.

```
Neue Route: app/api/export/route.ts
→ Testfall in: tests/export.spec.ts (oder passende bestehende Spec)
```
