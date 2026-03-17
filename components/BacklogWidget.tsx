'use client'
import { useEffect, useState } from 'react'
import supabase from '@/lib/supabaseClient'

interface RankingRow {
  user_id: string
  ingame_name: string
  threshold_per_res: number
  total_deposit: number
}

interface Props {
  lang: 'de' | 'en'
  currentUserId?: string
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export default function BacklogWidget({ lang, currentUserId }: Props) {
  const [items, setItems] = useState<(RankingRow & { pct: number })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const kw = getISOWeek(now)
      const year = now.getFullYear()
      const today = now.toISOString().split('T')[0]

      const [rankRes, exemptRes] = await Promise.all([
        supabase.rpc('get_ranking_data', { p_year: year, p_kw: kw, p_month: null }),
        supabase
          .from('member_exemptions')
          .select('user_id')
          .lte('start_date', today)
          .or('end_date.is.null,end_date.gte.' + today),
      ])

      if (rankRes.error || !rankRes.data) { setLoading(false); return }

      const exemptSet = new Set<string>(
        ((exemptRes.data as { user_id: string }[]) || []).map((e) => e.user_id)
      )

      const filtered = (rankRes.data as RankingRow[])
        .filter((r) => !exemptSet.has(r.user_id))
        .filter((r) => r.threshold_per_res > 0)
        .map((r) => ({
          ...r,
          pct: Math.min(100, Math.round((r.total_deposit / (r.threshold_per_res * 5)) * 100)),
        }))
        .filter((r) => r.pct < 100)
        .sort((a, b) => a.pct - b.pct)

      setItems(filtered)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null

  const redCount = items.filter((r) => r.pct < 60).length
  const title = lang === 'de' ? 'Rückstand (Laufzeit)' : 'Backlog (overall)'
  const emptyText = lang === 'de' ? '✓ Alle Mitglieder im Plan' : '✓ All members on track'

  if (items.length === 0) {
    return (
      <div className="bg-[#161822] border border-gray-800 rounded-xl p-4 mb-6 text-sm text-gray-400">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="bg-[#161822] border border-gray-800 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-300 flex-1">{title}</span>
        {redCount > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">
            {redCount} {lang === 'de' ? 'kritisch' : 'critical'}
          </span>
        )}
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-500 border border-yellow-800/50">
          {items.length} {lang === 'de' ? 'Spieler' : 'players'}
        </span>
      </div>

      <div className="flex flex-col">
        {items.map((r) => (
          <div
            key={r.user_id}
            className="flex items-center gap-3 py-1.5 border-t border-gray-800 first:border-t-0"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: r.pct < 60 ? '#E24B4A' : '#EF9F27' }}
            />
            <span className={'text-sm flex-1 ' + (r.user_id === currentUserId ? 'font-medium text-gray-200' : 'text-gray-400')}>
              {r.ingame_name}
              {r.user_id === currentUserId && (
                <span className="ml-1.5 text-xs text-gray-600">
                  ({lang === 'de' ? 'du' : 'you'})
                </span>
              )}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: r.pct + '%',
                  background: r.pct < 60 ? '#E24B4A' : '#EF9F27',
                }}
              />
            </div>
            <span
              className="text-xs font-medium w-9 text-right"
              style={{ color: r.pct < 60 ? '#f87171' : '#fbbf24' }}
            >
              {r.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Datei 2 — `app/dashboard/page.tsx` — zwei `str_replace`

**str_replace 1 — Import hinzufügen:**
```
old: import RankingTab from '@/components/RankingTab'
new: import RankingTab from '@/components/RankingTab'
import BacklogWidget from '@/components/BacklogWidget'
```

**str_replace 2 — Dashboard-Tab um Widget erweitern:**
```
old:         {activeTab === 'dashboard' && <Dashboard />}
new:         {activeTab === 'dashboard' && (
          <>
            <BacklogWidget lang={lang} currentUserId={profile?.id} />
            <Dashboard />
          </>
        )}
