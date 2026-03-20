'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

type FcuEvent = {
  id: string
  event_name: string
  event_date: string
  status: 'draft' | 'confirmed'
  created_at: string
}

type View = 'list' | 'upload' | 'results' | 'ranking'

interface Props {
  lang: Lang
}

export default function FCUEventTab({ lang }: Props) {
  const { profile } = useAuth()
  const [events, setEvents] = useState<FcuEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [activeEventId, setActiveEventId] = useState<string | null>(null)

  // Neues Event Formular
  const [showForm, setShowForm] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState('')

  const isAdmin = profile?.role === 'admin'

  const t = {
    title:        lang === 'de' ? 'FCU Events' : 'FCU Events',
    newEvent:     lang === 'de' ? 'Neues Event' : 'New Event',
    noEvents:     lang === 'de' ? 'Noch keine FCU Events.' : 'No FCU events yet.',
    ranking:      lang === 'de' ? 'Gesamtranking' : 'Overall Ranking',
    upload:       lang === 'de' ? 'Screenshots hochladen' : 'Upload Screenshots',
    results:      lang === 'de' ? 'Ergebnisse prüfen' : 'Review Results',
    confirmed:    lang === 'de' ? 'Bestätigt' : 'Confirmed',
    draft:        lang === 'de' ? 'Entwurf' : 'Draft',
    cancel:       lang === 'de' ? 'Abbrechen' : 'Cancel',
    create:       lang === 'de' ? 'Anlegen' : 'Create',
    namePlaceholder: lang === 'de' ? 'z.B. FCU März 2026' : 'e.g. FCU March 2026',
    back:         lang === 'de' ? '← Zurück' : '← Back',
  }

  useEffect(() => {
    loadEvents()
  }, [profile])

  async function loadEvents() {
    if (!profile?.clan_id) return
    setLoading(true)
    const { data } = await supabase
      .from('fcu_events')
      .select('id, event_name, event_date, status, created_at')
      .eq('clan_id', profile.clan_id)
      .order('event_date', { ascending: false })
    setEvents(data ?? [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!eventName.trim() || !eventDate) {
      setFeedback(lang === 'de' ? 'Name und Datum sind Pflichtfelder.' : 'Name and date are required.')
      return
    }
    setCreating(true)
    setFeedback('')
    const { data, error } = await supabase.rpc('create_fcu_event', {
      p_clan_id:    profile!.clan_id,
      p_event_name: eventName.trim(),
      p_event_date: eventDate,
    })
    setCreating(false)
    if (error || !data?.success) {
      setFeedback(data?.message || (lang === 'de' ? 'Fehler beim Anlegen.' : 'Error creating event.'))
      return
    }
    setShowForm(false)
    setEventName('')
    setEventDate('')
    await loadEvents()
    // Direkt zum Upload für das neue Event
    setActiveEventId(data.fcu_event_id)
    setView('upload')
  }

  function openUpload(eventId: string) {
    setActiveEventId(eventId)
    setView('upload')
  }

  function openResults(eventId: string) {
    setActiveEventId(eventId)
    setView('results')
  }

  function backToList() {
    setView('list')
    setActiveEventId(null)
    loadEvents()
  }

  // ── Sub-Views werden in eigenen Komponenten gerendert ──
  if (view === 'upload' && activeEventId) {
    const FCUUploadPanel = require('./FCUUploadPanel').default
    return <FCUUploadPanel lang={lang} eventId={activeEventId} onBack={backToList} onDone={() => { setView('results') }} />
  }

  if (view === 'results' && activeEventId) {
    const FCUResultsEditor = require('./FCUResultsEditor').default
    return <FCUResultsEditor lang={lang} eventId={activeEventId} onBack={backToList} />
  }

  if (view === 'ranking') {
    const FCURankingView = require('./FCURankingView').default
    return <FCURankingView lang={lang} onBack={() => setView('list')} />
  }

  // ── Haupt-Liste ──
  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <button
          onClick={() => setView('ranking')}
          className="text-sm text-blue-600 underline"
        >
          {t.ranking} 🏆
        </button>
      </div>

      {/* Neues Event — nur Admin */}
      {isAdmin && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 border border-dashed border-gray-400 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              + {t.newEvent}
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              {feedback && <p className="text-red-600 text-sm">{feedback}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 bg-blue-600 text-white rounded py-2 text-sm disabled:opacity-50"
                >
                  {creating ? '...' : t.create}
                </button>
                <button
                  onClick={() => { setShowForm(false); setFeedback('') }}
                  className="flex-1 border border-gray-300 rounded py-2 text-sm"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event-Liste */}
      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">{t.noEvents}</p>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{ev.event_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(ev.event_date).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <span className={
                  'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (ev.status === 'confirmed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800')
                }>
                  {ev.status === 'confirmed' ? t.confirmed : t.draft}
                </span>
              </div>

              {/* Aktionen — nur Admin */}
              {isAdmin && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openUpload(ev.id)}
                    className="flex-1 text-xs border border-gray-300 rounded py-1.5 hover:bg-gray-50"
                  >
                    📷 {t.upload}
                  </button>
                  {ev.status === 'draft' && (
                    <button
                      onClick={() => openResults(ev.id)}
                      className="flex-1 text-xs border border-blue-400 text-blue-600 rounded py-1.5 hover:bg-blue-50"
                    >
                      ✏️ {t.results}
                    </button>
                  )}
                  {ev.status === 'confirmed' && (
                    <button
                      onClick={() => openResults(ev.id)}
                      className="flex-1 text-xs border border-gray-300 rounded py-1.5 hover:bg-gray-50"
                    >
                      👁️ {t.results}
                    </button>
                  )}
                </div>
              )}

              {/* Mitglieder sehen nur Ergebnisse bei confirmed Events */}
              {!isAdmin && ev.status === 'confirmed' && (
                <button
                  onClick={() => openResults(ev.id)}
                  className="w-full mt-2 text-xs border border-gray-300 rounded py-1.5 hover:bg-gray-50"
                >
                  👁️ {t.results}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
