'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface HistoricalEntry {
  id: string
  ingame_name: string
  resource_type: string
  amount: number
  import_kw: number
  import_year: number
  transferred: boolean
}

const RESOURCE_LABELS: Record<string, string> = {
  cash: '💰 Cash', arms: '🔫 Arms', cargo: '📦 Cargo',
  metal: '⚙️ Metal', diamond: '💎 Diamond',
}

export default function HistoricalDepositsPanel({ lang }: { lang: Lang }) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<HistoricalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'transferred'>('pending')
  const [search, setSearch] = useState('')

  const t = (de: string, en: string) => lang === 'de' ? de : en

  useEffect(() => {
    if (profile?.clan_id) loadEntries()
  }, [profile?.clan_id])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('historical_deposits')
      .select('*')
      .eq('clan_id', profile!.clan_id)
      .order('ingame_name')
      .order('resource_type')
    if (data) setEntries(data as HistoricalEntry[])
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    if (filter === 'pending' && e.transferred) return false
    if (filter === 'transferred' && !e.transferred) return false
    if (search.trim() && !e.ingame_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Gruppieren nach Name
  const byName: Record<string, HistoricalEntry[]> = {}
  for (const e of filtered) {
    if (!byName[e.ingame_name]) byName[e.ingame_name] = []
    byName[e.ingame_name].push(e)
  }

  const totalPending = entries.filter(e => !e.transferred).length
  const totalTransferred = entries.filter(e => e.transferred).length
  const uniqueNamesPending = new Set(entries.filter(e => !e.transferred).map(e => e.ingame_name)).size

  if (loading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          {'🕐 ' + t('Historische Einzahlungen', 'Historical Deposits')}
        </h3>
        <button onClick={loadEntries} className="text-xs text-white/40 hover:text-white/70 transition">
          🔄 {t('Aktualisieren', 'Refresh')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-orange-900/20 border border-orange-500/20 rounded-lg p-2">
          <div className="text-lg font-bold text-orange-400">{uniqueNamesPending}</div>
          <div className="text-xs text-white/50">{t('Spieler ausstehend', 'players pending')}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{totalPending}</div>
          <div className="text-xs text-white/50">{t('Einträge ausstehend', 'entries pending')}</div>
        </div>
        <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-2">
          <div className="text-lg font-bold text-green-400">{totalTransferred}</div>
          <div className="text-xs text-white/50">{t('übertragen', 'transferred')}</div>
        </div>
      </div>

      {/* Filter + Suche */}
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'transferred', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'px-3 py-1 rounded-full text-xs border transition ' + (
              filter === f
                ? 'bg-white/15 border-white/30 text-white'
                : 'bg-transparent border-white/10 text-white/40 hover:text-white/70'
            )}>
            {f === 'pending' ? t('Ausstehend', 'Pending')
             : f === 'transferred' ? t('Übertragen', 'Transferred')
             : t('Alle', 'All')}
          </button>
        ))}
        <input
          type="text"
          placeholder={t('Name suchen...', 'Search name...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-32 bg-white/10 text-white rounded px-3 py-1 text-xs border border-white/20 focus:outline-none focus:border-white/40"
        />
      </div>

      {/* Liste */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {Object.keys(byName).length === 0 && (
          <div className="text-center text-white/40 text-sm py-6">
            {filter === 'pending'
              ? t('Keine ausstehenden Einträge.', 'No pending entries.')
              : t('Keine Einträge gefunden.', 'No entries found.')}
          </div>
        )}
        {Object.entries(byName).map(([name, nameEntries]) => {
          const allTransferred = nameEntries.every(e => e.transferred)
          const kw = nameEntries[0].import_kw
          const year = nameEntries[0].import_year
          return (
            <div key={name} className={
              'rounded-lg p-2 border text-xs ' +
              (allTransferred ? 'bg-green-900/10 border-green-500/15' : 'bg-white/5 border-white/10')
            }>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white/80">
                  {allTransferred ? '✅ ' : '🕐 '}{name}
                </span>
                <span className="text-white/30">{'KW ' + kw + '/' + year}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {nameEntries.map((e, i) => (
                  <span key={i} className={'px-1.5 py-0.5 rounded ' + (e.transferred ? 'bg-green-900/20 text-green-400/70' : 'bg-white/10 text-white/60')}>
                    {RESOURCE_LABELS[e.resource_type] ?? e.resource_type}{': '}{e.amount.toLocaleString('de-DE')}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
