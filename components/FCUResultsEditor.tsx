'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface Props {
  lang: Lang
  eventId: string
  onBack: () => void
}

type ResultRow = {
  rank: number
  ingame_name: string
  points: number
  profile_id: string | null
  dirty: boolean
}

type EventInfo = {
  event_name: string
  event_date: string
  status: 'draft' | 'confirmed'
}

export default function FCUResultsEditor({ lang, eventId, onBack }: Props) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ResultRow[]>([])
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [search, setSearch] = useState('')

  const isAdmin = profile?.role === 'admin'

  const t = {
    title:       lang === 'de' ? 'Ergebnisse prüfen' : 'Review Results',
    back:        lang === 'de' ? '← Zurück' : '← Back',
    rank:        lang === 'de' ? 'Rang' : 'Rank',
    name:        lang === 'de' ? 'Name' : 'Name',
    points:      lang === 'de' ? 'Punkte' : 'Points',
    matched:     lang === 'de' ? 'Gefunden' : 'Matched',
    save:        lang === 'de' ? 'Speichern & Bestätigen' : 'Save & Confirm',
    saving:      lang === 'de' ? 'Wird gespeichert...' : 'Saving...',
    noRows:      lang === 'de' ? 'Keine Ergebnisse vorhanden.' : 'No results available.',
    confirmed:   lang === 'de' ? '✅ Bestätigt' : '✅ Confirmed',
    draft:       lang === 'de' ? 'Entwurf' : 'Draft',
    searchHint:  lang === 'de' ? 'Name suchen...' : 'Search name...',
    unmatched:   lang === 'de' ? 'Kein Profil gefunden' : 'No profile match',
    total:       lang === 'de' ? 'Einträge' : 'entries',
    reopen:      lang === 'de' ? '✏️ Bearbeiten' : '✏️ Edit',
    reopening:   lang === 'de' ? 'Wird geöffnet...' : 'Opening...',
  }

  useEffect(() => {
    loadData()
  }, [eventId])

  async function loadData() {
    setLoading(true)
    setFeedback('')

    const { data: evData } = await supabase
      .from('fcu_events')
      .select('event_name, event_date, status')
      .eq('id', eventId)
      .single()
    setEventInfo(evData)

    const { data: dbRows } = await supabase
      .from('fcu_results')
      .select('rank, ingame_name, points, profile_id')
      .eq('fcu_event_id', eventId)
      .order('rank', { ascending: true })

    if (dbRows && dbRows.length > 0) {
      // Profilnamen für gematchte Spieler laden
      const profileIds = dbRows
        .filter(r => r.profile_id)
        .map(r => r.profile_id as string)

      let profileMap: Record<string, string> = {}
      if (profileIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, ingame_name')
          .in('id', profileIds)
        if (profileData) {
          profileData.forEach(p => {
            profileMap[p.id] = p.ingame_name
          })
        }
      }

      setRows(dbRows.map(r => ({
        ...r,
        // Profilname verwenden wenn vorhanden, sonst OCR-Name
        ingame_name: (r.profile_id && profileMap[r.profile_id]) ? profileMap[r.profile_id] : r.ingame_name,
        dirty: false,
      })))
      setLoading(false)
      return
    }

    const key = 'fcu_ocr_' + eventId
    const stored = sessionStorage.getItem(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setRows(parsed.map((r: { rank: number; ingame_name: string; points: number }) => ({
          rank:        r.rank,
          ingame_name: r.ingame_name,
          points:      r.points,
          profile_id:  null,
          dirty:       true,
        })))
      } catch { /* leer */ }
    }

    setLoading(false)
  }

  function updateName(rank: number, name: string) {
    setRows(prev => prev.map(r =>
      r.rank === rank ? { ...r, ingame_name: name, dirty: true } : r
    ))
  }

  function updatePoints(rank: number, points: number) {
    setRows(prev => prev.map(r =>
      r.rank === rank ? { ...r, points, dirty: true } : r
    ))
  }

  async function handleReopen() {
    setReopening(true)
    setFeedback("")
    const { data, error } = await supabase.rpc("reopen_fcu_event", { p_fcu_event_id: eventId })
    setReopening(false)
    if (error || !data?.success) {
      setFeedback(data?.message || (lang === "de" ? "Fehler beim Öffnen." : "Error reopening."))
      return
    }
    await loadData()
  }

  async function handleSave() {
    if (rows.length === 0) return
    setSaving(true)
    setFeedback('')

    const payload = rows.map(r => ({
      rank:        r.rank,
      ingame_name: r.ingame_name,
      points:      r.points,
    }))

    const { data, error } = await supabase.rpc('save_fcu_results', {
      p_fcu_event_id: eventId,
      p_results:      payload,
    })

    setSaving(false)

    if (error || !data?.success) {
      setFeedback(
        data?.message ||
        error?.message ||
        (lang === 'de' ? 'Fehler beim Speichern.' : 'Error saving.')
      )
      return
    }

    sessionStorage.removeItem('fcu_ocr_' + eventId)
    await loadData()
    setFeedback(lang === 'de' ? '✅ Gespeichert.' : '✅ Saved.')
  }

  const filtered = rows.filter(r =>
    r.ingame_name.toLowerCase().includes(search.toLowerCase())
  )

  const unmatchedCount = rows.filter(r => !r.profile_id).length
  const isConfirmed = eventInfo?.status === 'confirmed'

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200">
          {t.back}
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white">{t.title}</h2>
          {eventInfo && (
            <p className="text-xs text-gray-400 mt-0.5">
              {eventInfo.event_name + ' · ' + new Date(eventInfo.event_date).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isConfirmed && (
            <span className="text-xs bg-green-900/40 text-green-300 border border-green-600/40 px-2 py-0.5 rounded-full font-medium">
              {t.confirmed}
            </span>
          )}
          {isConfirmed && isAdmin && (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full border border-white/20 disabled:opacity-40"
            >
              {reopening ? t.reopening : t.reopen}
            </button>
          )}
        </div>
      </div>

      {/* Statistik-Zeile */}
      {rows.length > 0 && (
        <div className="flex gap-3 text-xs text-gray-400">
          <span>{rows.length + ' ' + t.total}</span>
          {unmatchedCount > 0 && isAdmin && isConfirmed && (
            <span className="text-amber-400">
              {'⚠️ ' + unmatchedCount + (lang === 'de' ? ' ohne Profilmatch' : ' unmatched')}
            </span>
          )}
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
        <p className="text-sm text-gray-400">{t.noRows}</p>
      ) : (
        <div className="space-y-1">
          {/* Kopfzeile */}
          <div className="grid grid-cols-12 gap-1 px-2 py-1 text-xs text-gray-500 font-medium">
            <div className="col-span-1">{t.rank}</div>
            <div className="col-span-7">{t.name}</div>
            <div className="col-span-3 text-right">{t.points}</div>
            <div className="col-span-1 text-center">✓</div>
          </div>

          {filtered.map(row => (
            <div
              key={row.rank}
              className={
                'grid grid-cols-12 gap-1 px-2 py-1.5 rounded items-center text-sm border ' +
                (row.rank <= 3
                  ? 'bg-amber-900/20 border-amber-600/30'
                  : 'bg-white/5 border-white/10')
              }
            >
              {/* Rang */}
              <div className="col-span-1 font-medium text-xs text-gray-300">
                {row.rank <= 3
                  ? (row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉')
                  : row.rank}
              </div>

              {/* Name */}
              <div className="col-span-7">
                {isAdmin && !isConfirmed ? (
                  <input
                    type="text"
                    value={row.ingame_name}
                    onChange={e => updateName(row.rank, e.target.value)}
                    className="w-full text-xs text-white border-b border-white/20 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                  />
                ) : (
                  <span className="text-xs text-white break-all">{row.ingame_name}</span>
                )}
              </div>

              {/* Punkte */}
              <div className="col-span-3 text-right">
                {isAdmin && !isConfirmed ? (
                  <input
                    type="number"
                    value={row.points}
                    onChange={e => updatePoints(row.rank, Number(e.target.value))}
                    className="w-full text-xs text-right text-white border-b border-white/20 bg-transparent focus:outline-none focus:border-blue-400 py-0.5"
                  />
                ) : (
                  <span className="text-xs text-gray-200">{row.points.toLocaleString('de-DE')}</span>
                )}
              </div>

              {/* Profilmatch */}
              <div className="col-span-1 text-center text-xs">
                {row.profile_id ? (
                  <span className="text-green-400">✓</span>
                ) : (
                  <span className="text-gray-600">–</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <p className={
          'text-sm ' + (feedback.startsWith('✅') ? 'text-green-400' : 'text-red-400')
        }>
          {feedback}
        </p>
      )}

      {/* Speichern */}
      {isAdmin && !isConfirmed && rows.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
        >
          {saving ? t.saving : t.save}
        </button>
      )}

    </div>
  )
}
