'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useExemptions } from '@/hooks/useExemptions'
import ExemptionBadge from '@/components/ExemptionBadge'

type Lang = 'de' | 'en'
type SortMode = 'value' | 'alpha'
type TabMode = 'gesamt' | 'ressource'

interface RankingRow {
  user_id: string
  ingame_name: string
  username: string
  start_kw: number
  start_year: number
  threshold_per_res: number
  deposit_cash: number
  deposit_arms: number
  deposit_cargo: number
  deposit_metal: number
  deposit_diamond: number
  total_deposit: number
}

const RESOURCES = [
  { key: 'deposit_cash',    label: 'Cash' },
  { key: 'deposit_arms',    label: 'Arms' },
  { key: 'deposit_cargo',   label: 'Cargo' },
  { key: 'deposit_metal',   label: 'Metal' },
  { key: 'deposit_diamond', label: 'Diamond' },
] as const

function pct(val: number, max: number) {
  if (max <= 0) return 100
  return Math.min(100, Math.round((val / max) * 100))
}

function ampelClass(p: number) {
  if (p >= 100) return 'bg-green-700'
  if (p >= 60)  return 'bg-amber-600'
  return 'bg-red-700'
}

function fmtMio(n: number) {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'M'
  if (n >= 1_000) return (Math.round(n / 100) / 10) + 'K'
  return String(n)
}

function metCount(row: RankingRow) {
  return RESOURCES.filter(r => row[r.key] >= row.threshold_per_res).length
}

export default function RankingTab({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>('value')
  const [tab, setTab] = useState<TabMode>('gesamt')
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [filterKw, setFilterKw] = useState<number | null>(null)
  const [raidleiterIds, setRaidleiterIds] = useState<Set<string>>(new Set())
  const [testIds, setTestIds] = useState<Set<string>>(new Set())
  const { getExemptionForUser } = useExemptions()

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, is_raidleiter, is_test')
      .then(({ data }) => {
        if (data) {
          const profiles = data as { id: string; is_raidleiter: boolean; is_test: boolean }[]
          setRaidleiterIds(new Set(profiles.filter(p => p.is_raidleiter).map(p => p.id)))
          setTestIds(new Set(profiles.filter(p => p.is_test).map(p => p.id)))
        }
      })
  }, [])

  useEffect(() => { fetchData() }, [filterMonth, filterKw])

  async function fetchData() {
    setLoading(true)
    const params: Record<string, number | null> = {
      p_year:  filterMonth || filterKw ? new Date().getFullYear() : null,
      p_kw:    filterKw,
      p_month: filterMonth,
    }
    const { data, error } = await supabase.rpc('get_ranking_data', params)
    if (!error && data) setRows(data as RankingRow[])
    setLoading(false)
  }

  function sorted(list: RankingRow[]) {
    // Testaccounts und Raidleiter herausfiltern
    const visible = list.filter(r => !testIds.has(r.user_id) && !raidleiterIds.has(r.user_id))
    if (sort === 'value') {
      return [...visible].sort((a, b) => b.total_deposit - a.total_deposit)
    }
    return [...visible].sort((a, b) =>
      (a.ingame_name || a.username).localeCompare(b.ingame_name || b.username)
    )
  }

  const currentKw = Math.ceil(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000
  )

  const kwOptions = Array.from({ length: currentKw }, (_, i) => i + 1)
  const monthOptions = [
    { v: 1,  de: 'Januar',    en: 'January' },
    { v: 2,  de: 'Februar',   en: 'February' },
    { v: 3,  de: 'März',      en: 'March' },
    { v: 4,  de: 'April',     en: 'April' },
    { v: 5,  de: 'Mai',       en: 'May' },
    { v: 6,  de: 'Juni',      en: 'June' },
    { v: 7,  de: 'Juli',      en: 'July' },
    { v: 8,  de: 'August',    en: 'August' },
    { v: 9,  de: 'September', en: 'September' },
    { v: 10, de: 'Oktober',   en: 'October' },
    { v: 11, de: 'November',  en: 'November' },
    { v: 12, de: 'Dezember',  en: 'December' },
  ]

  const t = {
    title:        { de: 'Ranking', en: 'Ranking' },
    gesamt:       { de: 'Gesamt', en: 'Overall' },
    ressource:    { de: 'Pro Ressource', en: 'Per Resource' },
    byValue:      { de: 'Nach Wert', en: 'By value' },
    byAlpha:      { de: 'A – Z', en: 'A – Z' },
    allMonths:    { de: 'Alle Monate', en: 'All months' },
    allKw:        { de: 'Alle KW', en: 'All weeks' },
    threshold:    { de: 'Soll', en: 'Target' },
    berechtigt:   { de: 'Auszahlung berechtigt', en: 'Eligible for payout' },
    nichtBerecht: { de: 'Nicht berechtigt', en: 'Not eligible' },
    rlBefreit:    { de: 'RL — befreit', en: 'RL — exempt' },
    noData:       { de: 'Keine Daten gefunden.', en: 'No data found.' },
    loading:      { de: 'Lädt...', en: 'Loading...' },
    legend_green: { de: 'Soll erreicht', en: 'Target reached' },
    legend_amber: { de: 'Auf Kurs', en: 'On track' },
    legend_red:   { de: 'Rückstand', en: 'Behind' },
    hint:         { de: 'Berechtigung: mind. 3 von 5 Ressourcen ≥ Schwellwert', en: 'Eligibility: at least 3 of 5 resources ≥ threshold' },
  }

  const sortedRows = sorted(rows)

  return (
    <div className="space-y-4">

      {/* Filter + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterMonth ?? ''}
          onChange={e => { setFilterMonth(e.target.value ? Number(e.target.value) : null) }}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500"
        >
          <option value="">{t.allMonths[lang]}</option>
          {monthOptions.map(m => (
            <option key={m.v} value={m.v}>{lang === 'de' ? m.de : m.en}</option>
          ))}
        </select>

        <select
          value={filterKw ?? ''}
          onChange={e => { setFilterKw(e.target.value ? Number(e.target.value) : null) }}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500"
        >
          <option value="">{t.allKw[lang]}</option>
          {kwOptions.map(kw => (
            <option key={kw} value={kw}>KW {kw}</option>
          ))}
        </select>

        <div className="ml-auto flex rounded-lg border border-zinc-700 overflow-hidden">
          <button
            onClick={() => setSort('value')}
            className={'px-3 py-1.5 text-sm transition-colors ' + (sort === 'value' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750')}
          >
            {t.byValue[lang]}
          </button>
          <button
            onClick={() => setSort('alpha')}
            className={'px-3 py-1.5 text-sm border-l border-zinc-700 transition-colors ' + (sort === 'alpha' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750')}
          >
            {t.byAlpha[lang]}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-zinc-800">
        {(['gesamt', 'ressource'] as TabMode[]).map(tt => (
          <button
            key={tt}
            onClick={() => setTab(tt)}
            className={'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ' + (tab === tt ? 'border-teal-500 text-teal-400' : 'border-transparent text-zinc-500 hover:text-zinc-300')}
          >
            {tt === 'gesamt' ? t.gesamt[lang] : t.ressource[lang]}
          </button>
        ))}
      </div>

      {/* Legende + Hinweis */}
      <div className="flex flex-wrap items-center gap-4">
        {[
          { cls: 'bg-green-700', label: t.legend_green[lang] },
          { cls: 'bg-amber-600', label: t.legend_amber[lang] },
          { cls: 'bg-red-700',   label: t.legend_red[lang] },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={'w-2 h-2 rounded-full inline-block ' + l.cls} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="text-yellow-400">⚔️</span>
          {lang === 'de' ? 'Raidleiter (befreit)' : 'Raid leader (exempt)'}
        </span>
        <span className="text-xs text-zinc-600 ml-auto">{t.hint[lang]}</span>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedRows.length === 0 ? (
        <p className="text-zinc-500 text-sm py-6 text-center">{t.noData[lang]}</p>
      ) : (
        <div className="space-y-2">
          {sortedRows.map((row, idx) => {
            const exemption = getExemptionForUser(row.user_id)
            const met = metCount(row)
            const berechtigt = met >= 3
            const totalThr = row.threshold_per_res * 5
            const totalPct = pct(row.total_deposit, totalThr)
            const rankLabel = sort === 'value' ? String(idx + 1) : '–'

            let alphaSep: string | null = null
            if (sort === 'alpha') {
              const name = (row.ingame_name || row.username)[0]?.toUpperCase() ?? ''
              const prevName = idx > 0
                ? (sortedRows[idx - 1].ingame_name || sortedRows[idx - 1].username)[0]?.toUpperCase() ?? ''
                : ''
              if (name !== prevName) alphaSep = name
            }

            return (
              <div key={row.user_id}>
                {alphaSep && (
                  <div className="text-xs text-zinc-600 font-medium px-1 pt-2 pb-1">{alphaSep}</div>
                )}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">

                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600 w-5 text-right shrink-0">{rankLabel}</span>
                    <div className="w-8 h-8 rounded-full bg-teal-900/40 border border-teal-800/40 flex items-center justify-center text-xs font-medium text-teal-400 shrink-0">
                      {(row.ingame_name || row.username).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-zinc-200 flex-1">
                      {row.ingame_name || row.username}
                    </span>
                    <ExemptionBadge exemption={exemption} />
                    <span className="text-xs text-zinc-500 shrink-0">
                      {fmtMio(row.total_deposit)} / {fmtMio(totalThr)}
                    </span>
                  </div>

                  {tab === 'gesamt' ? (
                    <>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={'h-full rounded-full ' + ampelClass(totalPct)}
                          style={{ width: totalPct + '%' }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{totalPct}% {lang === 'de' ? 'des Solls' : 'of target'}</span>
                        <span>{t.threshold[lang]}: {fmtMio(totalThr)} (KW {row.start_kw}/{row.start_year})</span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      {RESOURCES.map(res => {
                        const val = row[res.key]
                        const p = pct(val, row.threshold_per_res)
                        return (
                          <div key={res.key} className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-14 shrink-0">{res.label}</span>
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={'h-full rounded-full ' + ampelClass(p)}
                                style={{ width: p + '%' }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500 w-24 text-right shrink-0">
                              {fmtMio(val)} / {fmtMio(row.threshold_per_res)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Berechtigungs-Zeile */}
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                    <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (berechtigt ? 'bg-green-900/40 text-green-400 border border-green-800/40' : 'bg-red-900/30 text-red-400 border border-red-800/30')}>
                      {berechtigt ? t.berechtigt[lang] : t.nichtBerecht[lang]}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {met} / 5 {lang === 'de' ? 'Ressourcen erfüllt' : 'resources met'}
                    </span>
                    <div className="flex gap-1 ml-auto">
                      {RESOURCES.map((_, i) => (
                        <span
                          key={i}
                          className={'w-2.5 h-2.5 rounded-full ' + (i < met ? 'bg-green-700' : 'bg-zinc-700')}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
