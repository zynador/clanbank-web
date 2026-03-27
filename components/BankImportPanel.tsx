'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface BankImportPanelProps {
  lang: Lang
}

interface ImportRow {
  ingame_name: string
  resource_type: string
  amount: number
  kw: number
  year: number
  profile_id?: string
}

interface MemberOption {
  profile_id: string | null
  ingame_name: string
  is_registered: boolean
}

interface ImportResult {
  imported: number
  direct_deposits: number
  skipped_duplicates: number
}

const RESOURCE_HEADERS: Record<string, string> = {
  cash: 'cash', arms: 'arms', waffen: 'arms',
  cargo: 'cargo', metal: 'metal', metall: 'metal',
  diamond: 'diamond', diamant: 'diamond', diamonds: 'diamond',
  diamanten: 'diamond',
}

const NAME_HEADERS = [
  'name', 'spieler', 'ingame', 'ingame_name', 'ingamename',
  'spielername', 'player', 'ingame-name',
]

const RESOURCE_LABELS: Record<string, string> = {
  cash: '💰 Cash', arms: '🔫 Arms', cargo: '📦 Cargo',
  metal: '⚙️ Metal', diamond: '💎 Diamond',
}

function getISOWeek(date: Date): { kw: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const kw = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const year =
    date.getMonth() === 11 && kw === 1 ? date.getFullYear() + 1
    : date.getMonth() === 0 && kw >= 52 ? date.getFullYear() - 1
    : date.getFullYear()
  return { kw, year }
}

export default function BankImportPanel({ lang }: BankImportPanelProps) {
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { kw: defaultKw, year: defaultYear } = getISOWeek(new Date())
  const [importKw, setImportKw] = useState(defaultKw)
  const [importYear, setImportYear] = useState(defaultYear)

  const [members, setMembers] = useState<MemberOption[]>([])
  const [rows, setRows] = useState<ImportRow[]>([])
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([])
  const [unregisteredNames, setUnregisteredNames] = useState<string[]>([])
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const t = (de: string, en: string) => lang === 'de' ? de : en

  useEffect(() => {
    if (profile?.clan_id) loadMembers()
  }, [profile?.clan_id])

  async function loadMembers() {
    const { data } = await supabase.rpc('get_members_for_import', {
      p_clan_id: profile!.clan_id,
    })
    if (data) setMembers(data as MemberOption[])
  }

  function findMatch(name: string): MemberOption | undefined {
    const lower = name.toLowerCase().trim()
    return members.find(m => m.ingame_name.toLowerCase().trim() === lower)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setFileName(file.name)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const xlsxMod = await import('xlsx') as any
      const XLSX = xlsxMod.default ?? xlsxMod
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: 0 })

      if (!jsonData.length) {
        setError(t('Excel-Datei ist leer.', 'Excel file is empty.'))
        return
      }

      const rawHeaders = Object.keys(jsonData[0])

      let nameCol = rawHeaders[0]
      for (const h of rawHeaders) {
        if (NAME_HEADERS.includes(h.toLowerCase().trim())) { nameCol = h; break }
      }

      const resourceCols: Record<string, string> = {}
      for (const h of rawHeaders) {
        const n = h.toLowerCase().trim()
        if (RESOURCE_HEADERS[n]) resourceCols[h] = RESOURCE_HEADERS[n]
      }

      const headerLower = rawHeaders.map(h => h.toLowerCase().trim())
      const hasResourceCol = headerLower.some(h => ['ressource','resource','typ'].includes(h))
      const hasMengeCol = headerLower.some(h => ['menge','amount','betrag'].includes(h))
      const isLongFormat = hasResourceCol && hasMengeCol && Object.keys(resourceCols).length === 0

      const parsedRows: ImportRow[] = []
      const unmatchedSet = new Set<string>()
      const unregisteredSet = new Set<string>()

      const processName = (name: string, resource: string, amount: number) => {
        const match = findMatch(name)
        if (!match) {
          unmatchedSet.add(name)
        } else if (!match.is_registered) {
          unregisteredSet.add(name)
        }
        parsedRows.push({
          ingame_name: name,
          resource_type: resource,
          amount,
          kw: importKw,
          year: importYear,
          profile_id: (match?.is_registered && match.profile_id) ? match.profile_id : undefined,
        })
      }

      if (isLongFormat) {
        const resCol = rawHeaders.find(h => ['ressource','resource','typ'].includes(h.toLowerCase().trim()))!
        const amtCol = rawHeaders.find(h => ['menge','amount','betrag'].includes(h.toLowerCase().trim()))!
        for (const row of jsonData) {
          const name = String(row[nameCol] ?? '').trim()
          const resource = RESOURCE_HEADERS[String(row[resCol] ?? '').toLowerCase().trim()] ?? ''
          const amount = Number(row[amtCol] ?? 0)
          if (!name || !resource || amount <= 0) continue
          processName(name, resource, amount)
        }
      } else {
        for (const row of jsonData) {
          const name = String(row[nameCol] ?? '').trim()
          if (!name) continue
          for (const [col, resourceType] of Object.entries(resourceCols)) {
            const amount = Number(row[col] ?? 0)
            if (amount <= 0) continue
            processName(name, resourceType, amount)
          }
        }
      }

      if (!parsedRows.length) {
        setError(t('Keine gültigen Einträge gefunden.', 'No valid rows found.'))
        return
      }

      setRows(parsedRows)
      setUnmatchedNames(Array.from(unmatchedSet))
      setUnregisteredNames(Array.from(unregisteredSet))
      setManualMappings({})
      setStep('preview')
    } catch (err) {
      setError(t('Fehler beim Lesen: ', 'Error reading file: ') + String(err))
    }
  }

  function buildPayload(): Record<string, unknown>[] {
    return rows
      .filter(row => manualMappings[row.ingame_name] !== 'skip')
      .map(row => {
        const override = manualMappings[row.ingame_name]
        const obj: Record<string, unknown> = {
          ingame_name: row.ingame_name,
          resource_type: row.resource_type,
          amount: row.amount,
          kw: importKw,
          year: importYear,
        }
        const pid = (override && override !== 'skip') ? override : row.profile_id
        if (pid) obj.profile_id = pid
        return obj
      })
  }

  const rowsByName: Record<string, ImportRow[]> = {}
  for (const row of rows) {
    if (!rowsByName[row.ingame_name]) rowsByName[row.ingame_name] = []
    rowsByName[row.ingame_name].push(row)
  }

  const registeredMembers = members.filter(m => m.is_registered && m.profile_id)
  const allMembersForDropdown = members // alle, auch unregistrierte
  const totalNames = Object.keys(rowsByName).length
  const skippedCount = Object.keys(manualMappings).filter(k => manualMappings[k] === 'skip').length
  const readyCount = totalNames - unmatchedNames.filter(n => !manualMappings[n] || manualMappings[n] === 'skip').length - skippedCount

  async function handleImport() {
    setLoading(true)
    setError(null)
    try {
      const payload = buildPayload()
      const { data, error: rpcError } = await supabase.rpc('import_historical_deposits', {
        p_clan_id: profile!.clan_id,
        p_deposits: payload,
      })
      if (rpcError) { setError(rpcError.message); return }
      setResult({
        imported: Number(data?.imported ?? 0),
        direct_deposits: Number(data?.direct_deposits ?? 0),
        skipped_duplicates: Number(data?.skipped_duplicates ?? 0),
      })
      setStep('done')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('upload'); setRows([]); setUnmatchedNames([])
    setUnregisteredNames([]); setManualMappings({})
    setResult(null); setError(null); setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-white">
        📥 {t('Bankstand-Import (Historisch)', 'Bank Import (Historical)')}
      </h3>

      {/* UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 block mb-1">{t('Kalenderwoche', 'Calendar Week')}</label>
              <input type="number" value={importKw} min={1} max={53}
                onChange={e => setImportKw(Number(e.target.value))}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-white/40" />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1">{t('Jahr', 'Year')}</label>
              <input type="number" value={importYear} min={2024} max={2030}
                onChange={e => setImportYear(Number(e.target.value))}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-white/40" />
            </div>
          </div>

          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}>
            <div className="text-4xl mb-2">📊</div>
            <p className="text-white/70 text-sm font-medium">{t('Excel-Datei (.xlsx) hochladen', 'Upload Excel file (.xlsx)')}</p>
            <p className="text-white/40 text-xs mt-1">{t('Klicken zum Auswählen', 'Click to select')}</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

          <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium text-white/70">{t('Unterstützte Formate:', 'Supported formats:')}</p>
            <p className="text-white/50">{'📋 ' + t('Breit:', 'Wide:') + ' Name | Cash | Arms | Cargo | Metal | Diamond'}</p>
            <p className="text-white/50">{'📋 ' + t('Lang:', 'Long:') + ' Name | Ressource | Menge'}</p>
            <p className="text-green-400/70 pt-1">
              {'✅ ' + t(
                'Alle Spieler werden importiert — auch nicht registrierte. Ihre Daten werden automatisch übertragen sobald sie sich registrieren.',
                'All players are imported — including unregistered ones. Their data transfers automatically upon registration.'
              )}
            </p>
          </div>

          {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">⚠️ {error}</div>}
        </div>
      )}

      {/* VORSCHAU */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">{'📄 ' + (fileName ?? '') + ' — KW ' + importKw + '/' + importYear}</span>
            <button onClick={handleReset} className="text-xs text-white/40 hover:text-white/70 transition">✕ {t('Zurücksetzen', 'Reset')}</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 block mb-1">KW</label>
              <input type="number" value={importKw} min={1} max={53}
                onChange={e => setImportKw(Number(e.target.value))}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-white/40" />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1">{t('Jahr', 'Year')}</label>
              <input type="number" value={importYear} min={2024} max={2030}
                onChange={e => setImportYear(Number(e.target.value))}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-white/40" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-2">
              <div className="text-lg font-bold text-green-400">{totalNames - unmatchedNames.length}</div>
              <div className="text-xs text-white/50">{t('erkannt', 'matched')}</div>
            </div>
            <div className={'border rounded-lg p-2 ' + (unmatchedNames.filter(n => !manualMappings[n] || manualMappings[n] === 'skip').length > 0 ? 'bg-orange-900/20 border-orange-500/20' : 'bg-green-900/20 border-green-500/20')}>
              <div className={'text-lg font-bold ' + (unmatchedNames.filter(n => !manualMappings[n] || manualMappings[n] === 'skip').length > 0 ? 'text-orange-400' : 'text-green-400')}>
                {unmatchedNames.filter(n => !manualMappings[n] || manualMappings[n] === 'skip').length}
              </div>
              <div className="text-xs text-white/50">{t('unbekannt', 'unknown')}</div>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-400">{rows.length}</div>
              <div className="text-xs text-white/50">{t('Einträge', 'rows')}</div>
            </div>
          </div>

          {/* Legende */}
          <div className="flex gap-4 text-xs text-white/50 flex-wrap">
            <span>✓ {t('registriert → direkt in Bank', 'registered → direct to bank')}</span>
            <span>🕐 {t('nicht registriert → wird übertragen bei Registrierung', 'unregistered → transfers on registration')}</span>
          </div>

          {/* Unbekannte Namen */}
          {unmatchedNames.length > 0 && (
            <div className="bg-orange-900/10 border border-orange-500/20 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-orange-300">
                ⚠️ {t('Unbekannte Namen — zuordnen oder überspringen:', 'Unknown names — assign or skip:')}
              </p>
              {unmatchedNames.map(name => (
                <div key={name} className="flex items-center gap-2">
                  <span className={'text-xs w-36 truncate shrink-0 ' + (
                    manualMappings[name] && manualMappings[name] !== 'skip' ? 'text-green-400'
                    : manualMappings[name] === 'skip' ? 'text-white/30 line-through'
                    : 'text-white/70'
                  )}>
                    {manualMappings[name] && manualMappings[name] !== 'skip' ? '✓ ' : ''}{name}
                  </span>
                  <select value={manualMappings[name] ?? ''}
                    onChange={e => setManualMappings(prev => ({ ...prev, [name]: e.target.value }))}
                    className="flex-1 bg-white/10 text-white rounded px-2 py-1 text-xs border border-white/20">
                   <option value="">{t('-- als unbekannt speichern --', '-- save as unknown --')}</option>
                    <optgroup label={t('✓ Registriert', '✓ Registered')}>
                      {registeredMembers.map(m => (
                        <option key={m.profile_id!} value={m.profile_id!}>{m.ingame_name}</option>
                      ))}
                    </optgroup>
                    <optgroup label={t('🕐 Noch nicht registriert', '🕐 Not yet registered')}>
                      {allMembersForDropdown.filter(m => !m.is_registered).map(m => (
                        <option key={m.ingame_name} value={'ingame:' + m.ingame_name}>{m.ingame_name}</option>
                      ))}
                    </optgroup>
                    <option value="skip">{'⛔ ' + t('Überspringen', 'Skip')}</option>
                  </select>
                </div>
              ))}
              <p className="text-xs text-white/40 pt-1">
                💡 {t('Unbekannte Namen ohne Zuordnung werden trotzdem gespeichert und können später manuell verknüpft werden.', 'Unknown names without assignment are still saved and can be linked later.')}
              </p>
            </div>
          )}

          {/* Vorschauliste */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {Object.entries(rowsByName).map(([name, nameRows]) => {
              const isSkipped = manualMappings[name] === 'skip'
              const isUnregistered = unregisteredNames.includes(name)
              const isUnknown = unmatchedNames.includes(name) && (!manualMappings[name] || manualMappings[name] === 'skip')
              const hasOverride = manualMappings[name] && manualMappings[name] !== 'skip'
              const isMatched = !!nameRows[0].profile_id || hasOverride

              return (
                <div key={name} className={
                  'rounded-lg p-2 border text-xs ' +
                  (isSkipped ? 'bg-white/3 border-white/5 opacity-40'
                  : isUnknown ? 'bg-orange-900/10 border-orange-500/20'
                  : 'bg-white/5 border-white/10')
                }>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white/80">
                      {isSkipped ? '⛔ ' : isUnregistered ? '🕐 ' : isMatched ? '✓ ' : '⚠️ '}
                      {name}
                      {isUnregistered && (
                        <span className="ml-1 text-zinc-500 font-normal italic">{t('(nicht registriert — wird gespeichert)', '(not registered — will be saved)')}</span>
                      )}
                    </span>
                    <span className="text-white/40">{nameRows.length}{' '}{t('Res.', 'res.')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {nameRows.map((r, i) => (
                      <span key={i} className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                        {RESOURCE_LABELS[r.resource_type] ?? r.resource_type}{': '}{r.amount.toLocaleString('de-DE')}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">⚠️ {error}</div>}

          <button onClick={handleImport} disabled={loading || rows.length === 0}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-semibold transition">
            {loading
              ? '⏳ ' + t('Importiere...', 'Importing...')
              : '✅ ' + t('Alle importieren', 'Import all') + ' (' + (rows.length - rows.filter(r => manualMappings[r.ingame_name] === 'skip').length) + t(' Einträge)', ' rows)')}
          </button>
        </div>
      )}

      {/* FERTIG */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5 space-y-4">
            <h4 className="text-green-400 font-semibold text-base">✅ {t('Import abgeschlossen', 'Import complete')}</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{result.imported}</div>
                <div className="text-xs text-white/50">{t('gespeichert', 'saved')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{result.direct_deposits}</div>
                <div className="text-xs text-white/50">{t('direkt in Bank', 'direct to bank')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{result.skipped_duplicates}</div>
                <div className="text-xs text-white/50">{t('Duplikate', 'duplicates')}</div>
              </div>
            </div>
            <p className="text-xs text-white/40 text-center">
              🕐 {t(
                'Nicht registrierte Spieler: Daten werden automatisch in die Bank übertragen sobald ihr Claim bestätigt wird.',
                'Unregistered players: Data transfers to the bank automatically when their claim is confirmed.'
              )}
            </p>
          </div>
          <button onClick={handleReset}
            className="w-full bg-white/10 hover:bg-white/15 text-white rounded-lg px-4 py-2 text-sm transition">
            📥 {t('Weitere Datei importieren', 'Import another file')}
          </button>
        </div>
      )}
    </div>
  )
}
