# CLAUDE.md

Dieses Dokument definiert verbindliche Regeln für alle Code-Beiträge in diesem Projekt.

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
Jede Funktion — Handler, Hook, Hilfsfunktion — bleibt unter 30 Zeilen. Größere Logik wird in benannte Hilfsfunktionen aufgeteilt.

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

### Tests für jeden neuen `app/api/`-Endpunkt
Für jede neue Route unter `app/api/` wird ein Playwright-Testfall in der passenden Spec-Datei ergänzt. Bestehende Spec-Dateien sind in `tests/`.

```
Neue Route: app/api/export/route.ts
→ Testfall in: tests/export.spec.ts (oder passende bestehende Spec)
```
