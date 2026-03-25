'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface UnmatchedProfile {
  id: string
  ingame_name: string
  display_name: string | null
  role: string
  created_at: string
}

interface UnclaimedStarter {
  id: string
  ingame_name: string
  status: string
}

interface ScoredMatch {
  starter: UnclaimedStarter
  score: number
  reason: string
}

interface Props {
  lang: Lang
}

const t = (lang: Lang, de: string, en: string) => lang === 'de' ? de : en

// ─── Scoring-Algorithmus ───────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/gu, '').replace(/\s+/g, ' ').trim()
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = normalize(a).split(' ').filter(Boolean)
  const tokensB = normalize(b).split(' ').filter(Boolean)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const matches = tokensA.filter(t => tokensB.includes(t)).length
  return matches / Math.max(tokensA.length, tokensB.length)
}

function charOverlap(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na.length === 0 || nb.length === 0) return 0
  let matches = 0
  const used = new Array(nb.length).fill(false)
  for (const ch of na) {
    const idx = nb.split('').findIndex((c, i) => !used[i] && c === ch)
    if (idx !== -1) { matches++; used[idx] = true }
  }
  return matches / Math.max(na.length, nb.length)
}

function scoreMatch(profileName: string, starterName: string): { score: number; reason: string } {
  const pn = profileName.toLowerCase()
  const sn = starterName.toLowerCase()
  const np = normalize(profileName)
  const ns = normalize(starterName)

  if (np === ns) return { score: 100, reason: 'Exakter Match' }
  if (sn.includes(pn) || pn.includes(sn)) return { score: 82, reason: 'Name enthalten' }
  if (ns.includes(np) || np.includes(ns)) return { score: 78, reason: 'Name enthalten (normalisiert)' }

  const tScore = tokenOverlap(profileName, starterName)
  if (tScore >= 0.5) return { score: Math.round(55 + tScore * 25), reason: 'Token-Übereinstimmung' }

  const cScore = charOverlap(profileName, starterName)
  if (cScore >= 0.6) return { score: Math.round(cScore * 55), reason: 'Zeichen-Ähnlichkeit' }

  return { score: 0, reason: '' }
}

function getTopMatches(profile: UnmatchedProfile, starters: UnclaimedStarter[]): ScoredMatch[] {
  return starters
    .map(s => {
      const { score, reason } = scoreMatch(profile.ingame_name, s.ingame_name)
      return { starter: s, score, reason }
    })
    .filter(m => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function scoreBadgeColor(score: number): string {
  if (score >= 90) return 'bg-green-600 text-white'
  if (score >= 70) return 'bg-yellow-600 text-white'
  return 'bg-orange-700 text-white'
}

// ─── Komponente ───────────────────────────────────────────────────────────

export default function ProfileMatchPanel({ lang }: Props) {
  const { profile } = useAuth()
  const [profiles, setProfiles] = useState<UnmatchedProfile[]>([])
  const [starters, setStarters] = useState<UnclaimedStarter[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)
  const [manualSelect, setManualSelect] = useState<Record<string, string>>({})

  useEffect(() => {
    if (profile?.clan_id) loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_unmatched_profiles', {
      p_clan_id: profile!.clan_id
    })
    setLoading(false)
    if (error || !data?.success) {
      setFeedback(data?.message || 'Fehler beim Laden')
      return
    }
    setProfiles(data.unmatched_profiles || [])
    setStarters(data.unclaimed_starters || [])
  }

  async function handleLink(profileId: string, starterId: string) {
    setLinking(profileId)
    const { data, error } = await supabase.rpc('link_profile_to_starter', {
      p_profile_id: profileId,
      p_starter_id: starterId
    })
    setLinking(null)
    if (error || !data?.success) {
      setFeedback(data?.message || 'Fehler beim Verknüpfen')
      return
    }
    setFeedback(t(lang, 'Erfolgreich verknüpft!', 'Successfully linked!'))
    setExpandedProfile(null)
    await loadData()
  }

  if (!profile || !['admin', 'offizier'].includes(profile.role)) return null

  return (
    <div className="mt-6">
      <h3 className="font-semibold text-lg mb-1">
        🔗 {t(lang, 'Profil-Abgleich', 'Profile Matching')}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        {t(lang,
          'Profile ohne Starter-Eintrag — automatischer Abgleich mit Wahrscheinlichkeit',
          'Profiles without starter entry — automatic matching with probability score'
        )}
      </p>

      {feedback && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-900/30 text-blue-300 text-sm">
          {feedback}
          <button className="ml-3 text-blue-400 underline text-xs" onClick={() => setFeedback(null)}>
            {t(lang, 'Schließen', 'Close')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">⏳ {t(lang, 'Lade...', 'Loading...')}</p>
      ) : profiles.length === 0 ? (
        <div className="px-4 py-3 rounded bg-green-900/20 text-green-400 text-sm">
          ✅ {t(lang, 'Alle Profile sind verknüpft.', 'All profiles are linked.')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map(p => {
            const matches = getTopMatches(p, starters)
            const isExpanded = expandedProfile === p.id
            const selectedStarterId = manualSelect[p.id] || ''

            return (
              <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-medium">{p.ingame_name}</span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">{p.role}</span>
                    {matches.length > 0 && (
                      <span className="ml-2 text-xs bg-yellow-700/40 text-yellow-300 px-2 py-0.5 rounded-full">
                        {matches.length} {t(lang, 'Vorschlag', 'suggestion')}{matches.length > 1 ? (lang === 'de' ? 'e' : 's') : ''}
                      </span>
                    )}
                    {matches.length === 0 && (
                      <span className="ml-2 text-xs bg-gray-700/40 text-gray-400 px-2 py-0.5 rounded-full">
                        {t(lang, 'Kein Vorschlag', 'No suggestion')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedProfile(isExpanded ? null : p.id)}
                    className="text-xs text-blue-400 underline"
                  >
                    {isExpanded ? t(lang, 'Einklappen', 'Collapse') : t(lang, 'Verknüpfen', 'Link')}
                  </button>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2">

                    {/* Auto-Vorschläge */}
                    {matches.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 mb-1">
                          🤖 {t(lang, 'Automatische Vorschläge:', 'Automatic suggestions:')}
                        </p>
                        {matches.map(m => (
                          <div key={m.starter.id}
                            className="flex items-center justify-between gap-2 bg-white/5 rounded px-3 py-2"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={'text-xs px-2 py-0.5 rounded-full font-mono ' + scoreBadgeColor(m.score)}>
                                {m.score}%
                              </span>
                              <span className="text-sm">{m.starter.ingame_name}</span>
                              <span className="text-xs text-gray-500">{m.reason}</span>
                            </div>
                            <button
                              onClick={() => handleLink(p.id, m.starter.id)}
                              disabled={linking === p.id}
                              className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
                            >
                              {linking === p.id ? '⏳' : '✅ ' + t(lang, 'Verknüpfen', 'Link')}
                            </button>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Manuell auswählen */}
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">
                        🔍 {t(lang, 'Manuell auswählen:', 'Select manually:')}
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={selectedStarterId}
                          onChange={e => setManualSelect(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="flex-1 text-sm rounded bg-white/10 border border-white/20 px-2 py-1 text-white"
                        >
                          <option value="">— {t(lang, 'Starter wählen', 'Select starter')} —</option>
                          {starters.map(s => (
                            <option key={s.id} value={s.id}>{s.ingame_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedStarterId && handleLink(p.id, selectedStarterId)}
                          disabled={!selectedStarterId || linking === p.id}
                          className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                        >
                          {t(lang, 'Verknüpfen', 'Link')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
