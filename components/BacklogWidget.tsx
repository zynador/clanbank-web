'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

  const t = lang === 'de'
    ? { title: 'Rückstand', critical: 'kritisch', empty: 'Alle Mitglieder im Plan ✓' }
    : { title: 'Backlog', critical: 'critical', empty: 'All members on track ✓' }

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
        ((exemptRes.data as { user_id: string }[]) || []).map(e => e.user_id)
      )

      const filtered = (rankRes.data as RankingRow[])
        .filter(r => !exemptSet.has(r.user_id))
        .filter(r => r.threshold_per_res > 0)
        .map(r => ({
          ...r,
          pct: Math.min(100, Math.round((r.total_deposit / (r.threshold_per_res * 5)) * 100)),
        }))
        .filter(r => r.pct < 100)
        .sort((a, b) => a.pct - b.pct)

      setItems(filtered)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null

  const redCount = items.filter(r => r.pct < 60).length

  const dot = (pct: number) => (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
      background: pct < 60 ? '#E24B4A' : '#EF9F27',
    }} />
  )

  const badge = (text: string, red: boolean) => (
    <span style={{
      fontSize: 12,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 99,
      background: red ? '#FCEBEB' : '#FAEEDA',
      color: red ? '#A32D2D' : '#854F0B',
    }}>{text}</span>
  )

  if (items.length === 0) {
    return (
      <div style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-lg)',
        border: '0.5px solid var(--color-border-tertiary)',
        padding: '12px 16px',
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        marginBottom: '1rem',
      }}>
        {t.empty}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-lg)',
      border: '0.5px solid var(--color-border-tertiary)',
      padding: '12px 16px',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
          {t.title}
        </span>
        {redCount > 0 && badge(redCount + ' ' + t.critical, true)}
        {badge(items.length + (lang === 'de' ? ' Spieler' : ' players'), false)}
      </div>

      <div>
        {items.map(r => (
          <div key={r.user_id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 0',
            borderTop: '0.5px solid var(--color-border-tertiary)',
          }}>
            {dot(r.pct)}
            <span style={{
              fontSize: 14,
              color: 'var(--color-text-primary)',
              flex: 1,
              fontWeight: r.user_id === currentUserId ? 500 : 400,
            }}>
              {r.ingame_name}
              {r.user_id === currentUserId && (
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                  ({lang === 'de' ? 'du' : 'you'})
                </span>
              )}
            </span>
            <div style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: 'var(--color-background-secondary)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: 2,
                width: r.pct + '%',
                background: r.pct < 60 ? '#E24B4A' : '#EF9F27',
              }} />
            </div>
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              minWidth: 36,
              textAlign: 'right',
              color: r.pct < 60 ? '#A32D2D' : '#854F0B',
            }}>
              {r.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
