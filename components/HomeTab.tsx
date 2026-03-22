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

type LastFcu = {
  event_name: string
  rank: number | null
}

const RESOURCE_LABELS: Record<ResourceType, { emoji: string; label: string }> = {
  cash:    { emoji: '💵', label: 'Cash' },
  arms:    { emoji: '🔫', label: 'Arms' },
  cargo:   { emoji: '📦', label: 'Cargo' },
  metal:   { emoji: '⚙️', label: 'Metal' },
  diamond: { emoji: '💎', label: 'Diamond' },
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  cash:    'bg-yellow-100 text-yellow-800',
  arms:    'bg-red-100 text-red-800',
  cargo:   'bg-cyan-100 text-cyan-800',
  metal:   'bg-gray-200 text-gray-700',
  diamond: 'bg-purple-100 text-purple-800',
}

export default function HomeTab({ lang, onNavigate }: Props) {
  const { profile } = useAuth()
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null)
  const [backlog, setBacklog] = useState<BacklogMember[]>([])
  const [lastFcu, setLastFcu] = useState<LastFcu | null>(null)
  const [totalMembers, setTotalMembers] = useState(0)
  const [paidCount, setPaidCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin'
  const isOfficer = profile?.role === 'offizier'

  const t = {
    greeting:      lang === 'de' ? 'Willkommen' : 'Welcome',
    statusOk:      lang === 'de' ? 'Clanbank: Du bist auf dem Laufenden' : 'Clanbank: You are up to date',
    statusBehind:  lang === 'de' ? 'Clanbank: Du bist im Rückstand!' : 'Clanbank: You are behind!',
    weeksBehind:   lang === 'de' ? 'Wochen fehlen' : 'weeks missing',
    missingRes:    lang === 'de' ? 'Fehlende Ressourcen:' : 'Missing resources:',
    backlogTitle:  lang === 'de' ? 'Clanbank-Rückstand' : 'Clanbank backlog',
    membersBack:   lang === 'de' ? 'Mitglieder haben nicht eingezahlt' : 'members have not paid',
    paid:          lang === 'de' ? 'bezahlt' : 'paid',
    alsoBack:      lang === 'de' ? 'Auch im Rückstand' : 'Also behind',
    noBacklog:     lang === 'de' ? 'Alle Mitglieder haben eingezahlt.' : 'All members have paid.',
    quickActions:  lang === 'de' ? 'Schnellzugriff' : 'Quick Actions',
    deposit:       lang === 'de' ? 'Einzahlen' : 'Deposit',
    battle:        lang === 'de' ? 'Kampfbericht' : 'Battle Report',
    ranking:       lang === 'de' ? 'Ranking' : 'Ranking',
    fcu:           lang === 'de' ? 'FCU' : 'FCU',
    lastFcu:       lang === 'de' ? 'Letztes FCU' : 'Last FCU',
    rank:          lang === 'de' ? 'Rang' : 'Rank',
    noFcu:         lang === 'de' ? 'Noch kein FCU' : 'No FCU yet',
    weeksShort:    lang === 'de' ? 'KW' : 'W',
  }

  useEffect(() => {
    if (profile?.clan_id) loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    await Promise.all([loadMyStatus(), loadBacklog(), loadLastFcu()])
    setLoading(false)
  }

  async function loadMyStatus() {
    if (!profile?.id) return

    // Raidleiter sind von der Einzahlungspflicht befreit
    if ((profile as any).is_raidleiter) {
      setMyStatus({ weeks_behind: 0, missing_resources: [] })
      return
    }

    const now = new Date()
    const currentKw = getISOWeek(now)

    // Eigene Einzahlungen letzte 4 KW prüfen
    const since = new Date()
    since.setDate(since.getDate() - 28)

    const { data: myDeposits } = await supabase
      .from('deposits')
      .select('resource_type, created_at')
      .eq('user_id', profile.id)
      .eq('status', 'approved')
      .gte('created_at', since.toISOString())
      .is('deleted_at', null)

    const paid = new Set<string>()
    for (const d of myDeposits ?? []) {
      const kw = getISOWeek(new Date(d.created_at))
      paid.add(d.resource_type + '_' + kw)
    }

    // Welche Ressourcen fehlen in aktueller + letzter KW
    const resources: ResourceType[] = ['cash', 'arms', 'cargo', 'metal', 'diamond']
    const missing: ResourceType[] = []
    for (const res of resources) {
      const hasThisKw = paid.has(res + '_' + currentKw)
      const hasLastKw = paid.has(res + '_' + (currentKw - 1))
      if (!hasThisKw && !hasLastKw) missing.push(res)
    }

    // Wochen-Rückstand berechnen
    let weeksBehind = 0
    for (let w = currentKw - 1; w >= currentKw - 4; w--) {
      const hasAny = resources.some(r => paid.has(r + '_' + w))
      if (!hasAny) weeksBehind++
      else break
    }

    setMyStatus({ weeks_behind: weeksBehind, missing_resources: missing })
  }

  async function loadBacklog() {
    if (!profile?.clan_id) return

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, ingame_name')
      .eq('clan_id', profile.clan_id)
      .or('is_raidleiter.is.null,is_raidleiter.eq.false')
      .is('deleted_at', null)

    setTotalMembers(profiles?.length ?? 0)

    const since = new Date()
    since.setDate(since.getDate() - 28)

    const { data: deposits } = await supabase
      .from('deposits')
      .select('user_id, resource_type, created_at')
      .eq('clan_id', profile.clan_id)
      .eq('status', 'approved')
      .gte('created_at', since.toISOString())
      .is('deleted_at', null)

    const now = new Date()
    const currentKw = getISOWeek(now)
    const resources: ResourceType[] = ['cash', 'arms', 'cargo', 'metal', 'diamond']

    const paidSet = new Set<string>()
    for (const d of deposits ?? []) {
      const kw = getISOWeek(new Date(d.created_at))
      paidSet.add(d.user_id + '_' + d.resource_type + '_' + kw)
    }

    const behind: BacklogMember[] = []
    let paidThisKw = 0

    for (const p of profiles ?? []) {
      if (p.id === profile.id) continue

      // Wochen-Rückstand
      let weeksBehind = 0
      for (let w = currentKw - 1; w >= currentKw - 4; w--) {
        const hasAny = resources.some(r => paidSet.has(p.id + '_' + r + '_' + w))
        if (!hasAny) weeksBehind++
        else break
      }

      // Fehlende Ressourcen (aktuelle + letzte KW)
      const missing: ResourceType[] = []
      for (const res of resources) {
        const hasThisKw = paidSet.has(p.id + '_' + res + '_' + currentKw)
        const hasLastKw = paidSet.has(p.id + '_' + res + '_' + (currentKw - 1))
        if (!hasThisKw && !hasLastKw) missing.push(res)
      }

      if (weeksBehind === 0) paidThisKw++

      if (weeksBehind > 0 || missing.length > 0) {
        behind.push({
          user_id:           p.id,
          ingame_name:       p.ingame_name,
          weeks_behind:      weeksBehind,
          missing_resources: missing,
        })
      }
    }

    setPaidCount(paidThisKw)
    behind.sort((a, b) => b.weeks_behind - a.weeks_behind)
    setBacklog(behind)
  }

  async function loadLastFcu() {
    if (!profile?.clan_id) return

    const { data: events } = await supabase
      .from('fcu_events')
      .select('id, event_name')
      .eq('clan_id', profile.clan_id)
      .eq('status', 'confirmed')
      .order('event_date', { ascending: false })
      .limit(1)

    if (!events || events.length === 0) return

    const ev = events[0]

    const { data: result } = await supabase
      .from('fcu_results')
      .select('rank')
      .eq('fcu_event_id', ev.id)
      .eq('profile_id', profile.id)
      .single()

    setLastFcu({ event_name: ev.event_name, rank: result?.rank ?? null })
  }

  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  function kwBadgeColor(weeks: number): string {
    if (weeks >= 3) return 'bg-red-100 text-red-800'
    if (weeks === 2) return 'bg-orange-100 text-orange-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  if (loading) return <div className="p-4 text-sm text-gray-400">...</div>

  const isBehind = (myStatus?.weeks_behind ?? 0) > 0 || (myStatus?.missing_resources?.length ?? 0) > 0

  return (
    <div className="p-4 space-y-4">

      {/* Begrüssung */}
      <div>
        <p className="text-base font-semibold text-gray-800">
          {t.greeting + ', ' + (profile?.ingame_name ?? '') + ' 👋'}
        </p>
      </div>

      {/* Persönlicher Clanbank-Status */}
      {myStatus && (
        isBehind ? (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-sm flex-shrink-0">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-medium text-red-800">{t.statusBehind}</p>
                {myStatus.weeks_behind > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">
                    {myStatus.weeks_behind + ' ' + t.weeksBehind}
                  </p>
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
          <div className="bg-green-50 border border-green-300 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-sm flex-shrink-0">
              ✅
            </div>
            <p className="text-sm font-medium text-green-800">{t.statusOk}</p>
          </div>
        )
      )}

      {/* Clanbank-Rückstand (Wand der Schande) */}
      {(isAdmin || isOfficer) && (
        <div className={
          'rounded-xl p-3 space-y-2 border ' +
          (backlog.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')
        }>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">
              {'⚠️ ' + t.backlogTitle}
            </p>
            {totalMembers > 0 && (
              <span className="text-xs text-gray-500">
                {paidCount + '/' + totalMembers + ' ' + t.paid}
              </span>
            )}
          </div>

          {backlog.length === 0 ? (
            <p className="text-xs text-green-700">{t.noBacklog}</p>
          ) : (
            <div className="space-y-1.5">
              {backlog.map(member => (
                <div key={member.user_id} className="bg-white rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center text-xs font-medium text-red-800">
                        {member.ingame_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-800">{member.ingame_name}</span>
                    </div>
                    {member.weeks_behind > 0 && (
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + kwBadgeColor(member.weeks_behind)}>
                        {member.weeks_behind + ' ' + t.weeksShort}
                      </span>
                    )}
                  </div>
                  {member.missing_resources.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {member.missing_resources.map(res => (
                        <span key={res} className={'text-xs px-1.5 py-0.5 rounded-full ' + RESOURCE_COLORS[res]}>
                          {RESOURCE_LABELS[res].emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ankündigungen */}
      <AnnouncementWidget lang={lang} />

      {/* Stats-Zeile */}
      <div className="grid grid-cols-2 gap-2">
        {lastFcu && (
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-500">{t.lastFcu}</p>
            <p className="text-lg font-semibold text-gray-800 mt-0.5">
              {lastFcu.rank ? ('#' + lastFcu.rank) : '–'}
            </p>
            <p className="text-xs text-gray-400 truncate">{lastFcu.event_name}</p>
          </div>
        )}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500">{lang === 'de' ? 'Clan' : 'Clan'}</p>
          <p className="text-lg font-semibold text-gray-800 mt-0.5">
            {totalMembers > 0 ? Math.round(paidCount / totalMembers * 100) + '%' : '–'}
          </p>
          <p className="text-xs text-gray-400">{lang === 'de' ? 'haben eingezahlt' : 'have paid'}</p>
        </div>
      </div>

      {/* Schnellzugriff */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">{t.quickActions}</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '💰', label: t.deposit, tab: 'deposits' },
            { icon: '⚔️', label: t.battle,  tab: 'battle'   },
            { icon: '🏆', label: t.ranking, tab: 'ranking'  },
            { icon: '🎯', label: t.fcu,     tab: 'fcu'      },
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
