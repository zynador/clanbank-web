'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface Props {
  lang: Lang
  onBack: () => void
}

type RankingRow = {
  ingame_name: string
  profile_id: string | null
  event_count: number
  rank_sum: number
  avg_rank: number
  best_rank: number
  total_points: number
}

export default function FCURankingView({ lang, onBack }: Props) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const t = {
    title:       lang === 'de' ? 'FCU Gesamtranking' : 'FCU Overall Ranking',
    back:        lang === 'de' ? '← Zurück' : '← Back',
    name:        lang === 'de' ? 'Spieler' : 'Player',
    events:      lang === 'de' ? 'Events' : 'Events',
    totalPoints: lang === 'de' ? 'Punkte' : 'Points',
    bestRank:    lang === 'de' ? 'Bester' : 'Best',
    noData:      lang === 'de' ? 'Noch keine bestätigten Events.' : 'No confirmed events yet.',
    searchHint:  lang === 'de' ? 'Spieler suchen...' : 'Search player...',
    hint:        lang === 'de' ? 'Höchste Gesamtpunktzahl = Bester Platz' : 'Highest total points = best position',
    myRank:      lang === 'de' ? 'Mein Rang' : 'My Rank',
  }

  useEffect(() => {
    loadRanking()
  }, [profile])

  async function loadRanking() {
    if (!profile?.clan_id) return
    setLoading(true)
    const { data } = await supabase.rpc('get_fcu_overall_ranking', {
      p_clan_id: profile.clan_id,
    })
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = rows.filter(r =>
    r.ingame_name.toLowerCase().includes(search.toLowerCase())
  )

  const myPosition = profile?.ingame_name
    ? rows.findIndex(r =>
        r.ingame_name.toLowerCase() === profile.ingame_name.toLowerCase() ||
        r.profile_id === profile.id
      ) + 1
    : 0

  function formatPoints(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' Mio'
    if (n >= 1000) return (n / 1000).toFixed(0) + ' K'
    return n.toString()
  }

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200">
          {t.back}
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white">{t.title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t.hint}</p>
        </div>
      </div>

      {/* Eigener Rang — Highlight */}
      {myPosition > 0 && (
        <div className="bg-blue-900/40 border border-blue-600/50 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-300">{t.myRank}</span>
          <span className="text-xl font-semibold text-blue-200">{'#' + myPosition}</span>
        </div>
      )}

      {/* Top 3 Podest */}
      {rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 0, 2].map(i => {
            const row = rows[i]
            if (!row) return null
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
            const pos = i + 1
            const isMe = row.profile_id === profile?.id ||
              row.ingame_name.toLowerCase() === profile?.ingame_name?.toLowerCase()
            return (
              <div
                key={row.ingame_name}
                className={
                  'rounded-lg p-3 text-center border ' +
                  (pos === 1
                    ? 'bg-amber-900/30 border-amber-500/50'
                    : pos === 2
                    ? 'bg-white/10 border-white/20'
                    : 'bg-orange-900/30 border-orange-500/40') +
                  (isMe ? ' ring-2 ring-blue-400' : '')
                }
              >
                <div className="text-2xl">{medal}</div>
                <div className="text-xs font-medium mt-1 truncate text-white">{row.ingame_name}</div>
                <div className="text-xs text-gray-300 mt-0.5">
                  {formatPoints(row.total_points)} {lang === 'de' ? 'Pkt.' : 'pts'}
                </div>
                <div className="text-xs text-gray-400">
                  {row.event_count + (lang === 'de' ? ' Events' : ' events')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Suche */}
      {rows.length > 10 && (
        <input
          type="text"
          placeholder={t.searchHint}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-white/20 rounded px-3 py-2 text-sm bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
        />
      )}

      {/* Tabelle */}
      {loading ? (
        <p className="text-sm text-gray-400">...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">{t.noData}</p>
      ) : (
        <div className="space-y-1">

          {/* Kopfzeile */}
          <div className="grid grid-cols-12 gap-1 px-2 py-1 text-xs text-gray-500 font-medium">
            <div className="col-span-1">#</div>
            <div className="col-span-5">{t.name}</div>
            <div className="col-span-2 text-center">{t.events}</div>
            <div className="col-span-2 text-center">{t.totalPoints}</div>
            <div className="col-span-2 text-center">{t.bestRank}</div>
          </div>

          {filtered.map((row) => {
            const position = rows.indexOf(row) + 1
            const isMe = row.profile_id === profile?.id ||
              row.ingame_name.toLowerCase() === profile?.ingame_name?.toLowerCase()

            return (
              <div
                key={row.ingame_name}
                className={
                  'grid grid-cols-12 gap-1 px-2 py-2 rounded items-center text-sm border ' +
                  (isMe
                    ? 'bg-blue-900/40 border-blue-600/50 font-medium'
                    : position <= 3
                    ? 'bg-amber-900/20 border-amber-600/30'
                    : 'bg-white/5 border-white/10')
                }
              >
                {/* Position */}
                <div className="col-span-1 text-xs font-medium text-gray-300">
                  {position <= 3
                    ? (position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉')
                    : position}
                </div>

                {/* Name */}
                <div className="col-span-5 text-xs truncate text-white">
                  {row.ingame_name}
                  {isMe && (
                    <span className="ml-1 text-blue-400 text-xs">←</span>
                  )}
                </div>

                {/* Events */}
                <div className="col-span-2 text-center text-xs text-gray-300">
                  {row.event_count}
                </div>

                {/* Punkte */}
                <div className="col-span-2 text-center text-xs font-medium text-white">
                  {formatPoints(row.total_points)}
                </div>

                {/* Bester Rang */}
                <div className="col-span-2 text-center text-xs text-gray-300">
                  {'#' + row.best_rank}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
