'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
import AnnouncementWidget from './AnnouncementWidget'

type Lang = 'de' | 'en'
interface Props {
  lang: Lang
  onNavigate: (tab: string) => void
}
type ResourceType = 'cash' | 'arms' | 'cargo' | 'metal' | 'diamond'
type BacklogMember = {
  user_id: string
  ingame_name: string
  weeks_behind: number
  missing_resources: ResourceType[]
}
type MyStatus = {
  weeks_behind: number
  missing_resources: ResourceType[]
}
type MemberDetail = {
  user_id: string
  ingame_name: string
  weeks_behind: number
  total_all_time: number
  per_resource: Record<ResourceType, number>
}
type RankingEntry = {
  user_id: string
  ingame_name: string
  total_amount: number
  is_raidleiter: boolean
}
type FcuRankingEntry = {
  ingame_name: string
  total_points: number
}

const RESOURCES: ResourceType[] = ['cash', 'arms', 'cargo', 'metal', 'diamond']
const RESOURCE_LABELS: Record<ResourceType, { emoji: string; label: string }> = {
  cash: { emoji: '💵', label: 'Cash' },
  arms: { emoji: '🔫', label: 'Arms' },
  cargo: { emoji: '📦', label: 'Cargo' },
  metal: { emoji: '⚙️', label: 'Metal' },
  diamond: { emoji: '💎', label: 'Diamond' },
}
const RESOURCE_COLORS: Record<ResourceType, string> = {
  cash: 'bg-yellow-100 text-yellow-800',
  arms: 'bg-red-100 text-red-800',
  cargo: 'bg-cyan-100 text-cyan-800',
  metal: 'bg-gray-200 text-gray-700',
  diamond: 'bg-purple-100 text-purple-800',
}

function fmtMio(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'M'
  if (n >= 1_000) return (Math.round(n / 100) / 10) + 'K'
  return String(n)
}

function formatPoints(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2).replace('.', ',') + ' Mio'
  if (n >= 1000) return (n / 1000).toFixed(2).replace('.', ',') + ' K'
  return n.toFixed(2).replace('.', ',')
}

function kwBadgeColor(weeks: number): string {
  if (weeks >= 3) return 'text-red-600'
  if (weeks === 2) return 'text-orange-500'
  return 'text-yellow-600'
}

function barColor(pct: number): string {
  if (pct >= 100) return 'bg-green-600'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function valColor(pct: number): string {
  if (pct >= 100) return 'text-green-700'
  if (pct >= 60) return 'text-amber-600'
  return 'text-red-600'
}

export default function HomeTab({ lang, onNavigate }: Props) {
  const { profile } = useAuth()
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null)
  const [backlog, setBacklog] = useState<BacklogMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [threshold, setThreshold] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const [paidCount, setPaidCount] = useState(0)
  const [bankRanking, setBankRanking] = useState<RankingEntry[]>([])
  const [fcuRanking, setFcuRanking] = useState<FcuRankingEntry[]>([])

  const isAdmin = profile?.role === 'admin'
  const isOfficer = profile?.role === 'offizier'

  const t = {
    greeting: lang === 'de' ? 'Willkommen' : 'Welcome',
    statusOk: lang === 'de' ? 'Clanbank: Du bist auf dem Laufenden' : 'Clanbank: You are up to date',
    statusBehind: lang === 'de' ? 'Clanbank: Du bist im Rückstand!' : 'Clanbank: You are behind!',
    weeksBehind: lang === 'de' ? 'Wochen fehlen' : 'weeks missing',
    missingRes: lang === 'de' ? 'Fehlende Ressourcen:' : 'Missing resources:',
    backlogTitle: lang === 'de' ? 'Clanbank-Rückstand' : 'Clanbank backlog',
    paid: lang === 'de' ? 'bezahlt' : 'paid',
    noBacklog: lang === 'de' ? 'Alle Mitglieder haben eingezahlt.' : 'All members have paid.',
    quickActions: lang === 'de' ? 'Schnellzugriff' : 'Quick Actions',
    deposit: lang === 'de' ? 'Einzahlen' : 'Deposit',
    battle: lang === 'de' ? 'Kampfbericht' : 'Battle Report',
    ranking: lang === 'de' ? 'Ranking' : 'Ranking',
    fcu: lang === 'de' ? 'FCU' : 'FCU',
    weeksShort: lang === 'de' ? 'KW' : 'W',
    close: lang === 'de' ? '✕ schließen' : '✕ close',
    totalAll: lang === 'de' ? 'Gesamt eingezahlt' : 'Total deposited',
    schwellwert: lang === 'de' ? 'Schwellwert / Res.' : 'Threshold / res.',
    behind: lang === 'de' ? 'Rückstand' : 'behind',
    bankRanking: lang === 'de' ? '🏦 Bank-Ranking' : '🏦 Bank Ranking',
    fcuRanking: lang === 'de' ? '🎯 FCU-Ranking' : '🎯 FCU Ranking',
    more: lang === 'de' ? '→ Mehr' : '→ More',
    noData: lang === 'de' ? 'Noch keine Daten' : 'No data yet',
    noFcuData: lang === 'de' ? 'Noch keine FCU-Daten' : 'No FCU data yet',
    pkt: lang === 'de' ? ' Pkt.' : ' pts',
  }

  useEffect(() => {
    if (profile?.clan_id) loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const kw = getISOWeek(new Date())
    setThreshold((kw - 2) * 5_000_000)
    await Promise.all([loadMyStatus(), loadBacklog(), loadBankRanking(), loadFcuRanking()])
    setLoading(false)
  }

  async function loadMyStatus() {
    if (!profile?.id) return
    if ((profile as unknown as Record<string, unknown>).is_raidleiter) {
      setMyStatus({ weeks_behind: 0, missing_resources: [] })
      return
    }
    const now = new Date()
    const currentKw = getISOWeek(now)
    const since = new Date()
    since.setDate(since.getDate() - 28)
    const { data: myDeposits } = await supabase
      .from('deposits').select('resource_type, created_at')
      .eq('user_id', profile.id).eq('status', 'approved')
      .gte('created_at', since.toISOString()).is('deleted_at', null)
    const paid = new Set<string>()
    for (const d of myDeposits ?? []) {
      const kw = getISOWeek(new Date(d.created_at))
      paid.add(d.resource_type + '_' + kw)
    }
    const missing: ResourceType[] = []
    for (const res of RESOURCES) {
      if (!paid.has(res + '_' + currentKw) && !paid.has(res + '_' + (currentKw - 1)))
        missing.push(res)
    }
    let weeksBehind = 0
    for (let w = currentKw - 1; w >= currentKw - 4; w--) {
      const hasAny = RESOURCES.some(r => paid.has(r + '_' + w))
      if (!hasAny) weeksBehind++
      else break
    }
    setMyStatus({ weeks_behind: weeksBehind, missing_resources: missing })
  }

  async function loadBacklog() {
    if (!profile?.clan_id) return
    const { data: allProfiles } = await supabase
      .from('profiles').select('id, ingame_name, is_raidleiter, is_test, is_bank')
      .eq('clan_id', profile.clan_id)
    const profiles = (allProfiles ?? []).filter(
      p => !(p as unknown as Record<string, unknown>).is_raidleiter
        && !(p as unknown as Record<string, unknown>).is_test
        && !(p as unknown as Record<string, unknown>).is_bank
    )
    setTotalMembers(profiles.length)
    const since = new Date()
    since.setDate(since.getDate() - 28)
    const { data: deposits } = await supabase
      .from('deposits').select('user_id, resource_type, created_at')
      .eq('clan_id', profile.clan_id).eq('status', 'approved')
      .gte('created_at', since.toISOString()).is('deleted_at', null)
    const now = new Date()
    const currentKw = getISOWeek(now)
    const paidSet = new Set<string>()
    for (const d of deposits ?? []) {
      const kw = getISOWeek(new Date(d.created_at))
      paidSet.add(d.user_id + '_' + d.resource_type + '_' + kw)
    }
    const behind: BacklogMember[] = []
    let paidThisKw = 0
    for (const p of profiles) {
      if (p.id === profile.id) continue
      let weeksBehind = 0
      for (let w = currentKw - 1; w >= currentKw - 4; w--) {
        const hasAny = RESOURCES.some(r => paidSet.has(p.id + '_' + r + '_' + w))
        if (!hasAny) weeksBehind++
        else break
      }
      const missing: ResourceType[] = []
      for (const res of RESOURCES) {
        const hasThisKw = paidSet.has(p.id + '_' + res + '_' + currentKw)
        const hasLastKw = paidSet.has(p.id + '_' + res + '_' + (currentKw - 1))
        if (!hasThisKw && !hasLastKw) missing.push(res)
      }
      if (weeksBehind === 0) paidThisKw++
      if (weeksBehind > 0 || missing.length > 0)
        behind.push({ user_id: p.id, ingame_name: p.ingame_name, weeks_behind: weeksBehind, missing_resources: missing })
    }
    setPaidCount(paidThisKw)
    behind.sort((a, b) => b.weeks_behind - a.weeks_behind)
    setBacklog(behind)
  }

  async function loadDetail(member: BacklogMember) {
    if (selectedId === member.user_id) { setSelectedId(null); setDetail(null); return }
    setSelectedId(member.user_id)
    setDetailLoading(true)

    // Reguläre Einzahlungen per user_id
    const { data: depositsData } = await supabase
      .from('deposits').select('resource_type, amount')
      .eq('user_id', member.user_id).eq('status', 'approved').is('deleted_at', null)

    // Historische Einzahlungen per ingame_name (noch nicht übertragen)
    const { data: histData } = await supabase
      .from('historical_deposits').select('resource_type, amount')
      .eq('ingame_name', member.ingame_name)
      .eq('clan_id', profile?.clan_id ?? '')
      .eq('transferred', false)

    const perResource: Record<ResourceType, number> = { cash: 0, arms: 0, cargo: 0, metal: 0, diamond: 0 }
    let totalAllTime = 0

    // deposits.resource_type ist ENUM (grossgeschrieben) → auf lowercase normalisieren
    for (const d of depositsData ?? []) {
      const rt = (d.resource_type as string).toLowerCase() as ResourceType
      if (perResource[rt] !== undefined) { perResource[rt] += d.amount; totalAllTime += d.amount }
    }

    // historical_deposits.resource_type ist plain text (bereits lowercase)
    for (const d of histData ?? []) {
      const rt = (d.resource_type as string).toLowerCase() as ResourceType
      if (perResource[rt] !== undefined) { perResource[rt] += d.amount; totalAllTime += d.amount }
    }

    setDetail({
      user_id: member.user_id,
      ingame_name: member.ingame_name,
      weeks_behind: member.weeks_behind,
      total_all_time: totalAllTime,
      per_resource: perResource,
    })
    setDetailLoading(false)
  }

  async function loadBankRanking() {
    if (!profile?.clan_id) return
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, is_bank, is_raidleiter, is_test')
        .eq('clan_id', profile.clan_id)
      const bankIds = new Set<string>()
      const testIds = new Set<string>()
      const raidleiterIds = new Set<string>()
      for (const p of profileData ?? []) {
        if ((p as unknown as Record<string, unknown>).is_bank) bankIds.add(p.id)
        if ((p as unknown as Record<string, unknown>).is_test) testIds.add(p.id)
        if ((p as unknown as Record<string, unknown>).is_raidleiter) raidleiterIds.add(p.id)
      }
      const { data } = await supabase.rpc('get_ranking_data')
      if (!data) return
      const sorted = (data as unknown as Record<string, unknown>[])
        .filter((r) => !bankIds.has(r.user_id as string) && !testIds.has(r.user_id as string))
        .sort((a, b) => Number(b.total_deposit) - Number(a.total_deposit))
        .slice(0, 5)
        .map((r) => ({
          user_id: (r.user_id ?? r.ingame_name) as string,
          ingame_name: (r.ingame_name || r.username || '?') as string,
          total_amount: Number(r.total_deposit),
          is_raidleiter: raidleiterIds.has(r.user_id as string),
        }))
      setBankRanking(sorted)
    } catch {}
  }

  async function loadFcuRanking() {
    if (!profile?.clan_id) return
    const { data } = await supabase.rpc('get_fcu_overall_ranking', { p_clan_id: profile.clan_id })
    if (!data) return
    setFcuRanking(
      (data as unknown as Record<string, unknown>[]).slice(0, 5).map(d => ({
        ingame_name: d.ingame_name as string,
        total_points: Number(d.total_points),
      }))
    )
  }

  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  if (loading) return <div className="p-4 text-sm text-gray-400">...</div>

  const isBehind = (myStatus?.weeks_behind ?? 0) > 0 || (myStatus?.missing_resources?.length ?? 0) > 0

  return (
    <div className="p-4 space-y-4">
      {/* Begrüßung */}
      <div>
        <p className="text-base font-semibold text-gray-800">
          {t.greeting + ', ' + (profile?.ingame_name ?? '') + ' 👋'}
        </p>
      </div>

      {/* Persönlicher Status */}
      {myStatus && (
        isBehind ? (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 space-y-2" data-tour-id="home-status">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-sm flex-shrink-0">⚠️</div>
              <div>
                <p className="text-sm font-medium text-red-800">{t.statusBehind}</p>
                {myStatus.weeks_behind > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">{myStatus.weeks_behind + ' ' + t.weeksBehind}</p>
                )}
              </div>
            </div>
            {myStatus.missing_resources.length > 0 && (
              <div className="bg-white rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1.5">{t.missingRes}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {myStatus.missing_resources.map(res => (
                    <span key={res} className={'text-xs px-2 py-0.5 rounded-full font-medium ' + RESOURCE_COLORS[res]}>
                      {RESOURCE_LABELS[res].emoji + ' ' + RESOURCE_LABELS[res].label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-300 rounded-xl p-3 flex items-center gap-3" data-tour-id="home-status">
            <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-sm flex-shrink-0">✅</div>
            <p className="text-sm font-medium text-green-800">{t.statusOk}</p>
          </div>
        )
      )}

      {/* Wand der Schande */}
      {(isAdmin || isOfficer) && (
        <div
          data-tour-id="home-backlog"
          className={'rounded-xl p-3 space-y-3 border ' + (backlog.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">{'⚠️ ' + t.backlogTitle}</p>
            {totalMembers > 0 && (
              <span className="text-xs text-gray-500">{paidCount + '/' + totalMembers + ' ' + t.paid}</span>
            )}
          </div>
          {backlog.length === 0 ? (
            <p className="text-xs text-green-700">{t.noBacklog}</p>
          ) : (
            <>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
                {backlog.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => loadDetail(member)}
                    className={'text-left bg-white rounded-lg px-2.5 py-2 border transition-colors ' + (selectedId === member.user_id ? 'border-gray-400' : 'border-gray-100 hover:border-gray-300')}
                  >
                    <p className="text-xs font-medium text-gray-800 truncate mb-1">{member.ingame_name}</p>
                    {member.weeks_behind > 0 && (
                      <p className={'text-xs font-medium mb-1 ' + kwBadgeColor(member.weeks_behind)}>
                        {member.weeks_behind + ' ' + t.weeksShort}
                      </p>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {member.missing_resources.map(res => (
                        <span key={res} className={'text-xs px-1 py-0.5 rounded ' + RESOURCE_COLORS[res]}>
                          {RESOURCE_LABELS[res].emoji}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {selectedId && (
                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
                  {detailLoading ? (
                    <p className="text-xs text-gray-400 text-center py-2">...</p>
                  ) : detail ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{detail.ingame_name}</span>
                          {detail.weeks_behind > 0 && (
                            <span className={'text-xs font-medium ' + kwBadgeColor(detail.weeks_behind)}>
                              {detail.weeks_behind + ' ' + t.weeksShort + ' ' + t.behind}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { setSelectedId(null); setDetail(null) }}
                          className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                        >
                          {t.close}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">{t.totalAll}</p>
                          <p className="text-lg font-semibold text-gray-800">{fmtMio(detail.total_all_time)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-500 mb-0.5">{t.schwellwert}</p>
                          <p className="text-lg font-semibold text-gray-800">{fmtMio(threshold)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {RESOURCES.map(res => {
                          const val = detail.per_resource[res]
                          const pct = threshold > 0 ? Math.min(100, Math.round(val / threshold * 100)) : 100
                          return (
                            <div key={res} className="flex items-center gap-2">
                              <span className="text-sm w-5 text-center">{RESOURCE_LABELS[res].emoji}</span>
                              <span className="text-xs text-gray-500 w-12 flex-shrink-0">{RESOURCE_LABELS[res].label}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={'h-full rounded-full ' + barColor(pct)} style={{ width: pct + '%' }} />
                              </div>
                              <span className={'text-xs font-medium w-20 text-right flex-shrink-0 ' + valColor(pct)}>
                                {fmtMio(val) + ' / ' + fmtMio(threshold)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Ankündigungen */}
      <AnnouncementWidget lang={lang} />

      {/* Doppel-Podest Ranking */}
      <div className="grid grid-cols-2 gap-2">
        {/* Bank-Ranking */}
        <div className="bg-white border border-gray-100 rounded-xl p-3" data-tour-id="home-ranking-bank">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">{t.bankRanking}</p>
            <button onClick={() => onNavigate('ranking')} className="text-xs text-teal-600 hover:underline">{t.more}</button>
          </div>
          {bankRanking.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">{t.noData}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 items-end mb-2">
                {[1, 0, 2].map((i: number) => {
                  const entry = bankRanking[i]
                  if (!entry) return <div key={i} />
                  const isGold = i === 0
                  const isSilver = i === 1
                  return (
                    <div
                      key={i}
                      className={'rounded-lg p-1.5 text-center border ' + (isGold ? 'border-yellow-200 bg-yellow-50' : isSilver ? 'border-gray-200 bg-gray-50' : 'border-orange-100 bg-orange-50')}
                    >
                      <p className="text-xs mb-0.5" style={{ color: isGold ? '#b7950b' : isSilver ? '#7f8c8d' : '#a04000' }}>
                        {(i + 1) + '.'}
                      </p>
                      <div className={isGold ? 'text-xl mb-1' : 'text-base mb-1'}>
                        {isGold ? '🏆' : isSilver ? '🥈' : '🥉'}
                      </div>
                      <p className={'text-xs font-medium truncate ' + (isGold ? 'text-yellow-700' : 'text-gray-700')}>
                        {entry.ingame_name}{entry.is_raidleiter ? ' ⚔️' : ''}
                      </p>
                      <p className="text-xs text-gray-400">{fmtMio(entry.total_amount)}</p>
                    </div>
                  )
                })}
              </div>
              {bankRanking.slice(3, 5).map((entry, idx) => (
                <div key={entry.user_id} className="flex items-center gap-1.5 py-1 border-t border-gray-50">
                  <span className="text-xs text-gray-400 w-3 flex-shrink-0">{(idx + 4) + '.'}</span>
                  <span className="flex-1 text-xs text-gray-700 truncate">
                    {entry.ingame_name}{entry.is_raidleiter ? ' ⚔️' : ''}
                  </span>
                  <span className="text-xs text-gray-400">{fmtMio(entry.total_amount)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* FCU-Ranking */}
        <div className="bg-white border border-gray-100 rounded-xl p-3" data-tour-id="home-ranking-fcu">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">{t.fcuRanking}</p>
            <button onClick={() => onNavigate('fcu')} className="text-xs text-teal-600 hover:underline">{t.more}</button>
          </div>
          {fcuRanking.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">{t.noFcuData}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 items-end mb-2">
                {[1, 0, 2].map((i: number) => {
                  const entry = fcuRanking[i]
                  if (!entry) return <div key={i} />
                  const isGold = i === 0
                  const isSilver = i === 1
                  return (
                    <div
                      key={i}
                      className={'rounded-lg p-1.5 text-center border ' + (isGold ? 'border-yellow-200 bg-yellow-50' : isSilver ? 'border-gray-200 bg-gray-50' : 'border-orange-100 bg-orange-50')}
                    >
                      <p className="text-xs mb-0.5" style={{ color: isGold ? '#b7950b' : isSilver ? '#7f8c8d' : '#a04000' }}>
                        {(i + 1) + '.'}
                      </p>
                      <div className={isGold ? 'text-xl mb-1' : 'text-base mb-1'}>
                        {isGold ? '🏆' : isSilver ? '🥈' : '🥉'}
                      </div>
                      <p className={'text-xs font-medium truncate ' + (isGold ? 'text-yellow-700' : 'text-gray-700')}>
                        {entry.ingame_name}
                      </p>
                      <p className="text-xs text-gray-400">{formatPoints(entry.total_points) + t.pkt}</p>
                    </div>
                  )
                })}
              </div>
              {fcuRanking.slice(3, 5).map((entry, idx) => (
                <div key={entry.ingame_name} className="flex items-center gap-1.5 py-1 border-t border-gray-50">
                  <span className="text-xs text-gray-400 w-3 flex-shrink-0">{(idx + 4) + '.'}</span>
                  <span className="flex-1 text-xs text-gray-700 truncate">{entry.ingame_name}</span>
                  <span className="text-xs text-gray-400">{formatPoints(entry.total_points) + t.pkt}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Schnellzugriff */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">{t.quickActions}</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '💰', label: t.deposit, tab: 'deposits' },
            { icon: '⚔️', label: t.battle, tab: 'battle' },
            { icon: '🏆', label: t.ranking, tab: 'ranking' },
            { icon: '🎯', label: t.fcu, tab: 'fcu' },
          ].map(action => (
            <button
              key={action.tab}
              onClick={() => onNavigate(action.tab)}
              className="bg-white border border-gray-100 rounded-xl py-3 flex flex-col items-center gap-1 hover:bg-gray-50 active:scale-95 transition-transform"
            >
              <span className="text-lg">{action.icon}</span>
              <span className="text-xs text-gray-600">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
