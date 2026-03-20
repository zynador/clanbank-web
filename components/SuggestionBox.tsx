'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
import InfoTooltip from '@/components/InfoTooltip'

type SuggestionStatus = 'open' | 'answered' | 'closed'
type Lang = 'de' | 'en'
type Suggestion = {
  id: string
  user_id: string
  text: string
  response: string | null
  responded_at: string | null
  status: SuggestionStatus
  created_at: string
  player_name?: string
}

function StatusBadge({ status, lang }: { status: SuggestionStatus; lang: Lang }) {
  const labels = { open: { de: 'Offen', en: 'Open' }, answered: { de: 'Beantwortet', en: 'Answered' }, closed: { de: 'Geschlossen', en: 'Closed' } }
  const colors = { open: 'bg-yellow-900/40 text-yellow-400 border-yellow-800', answered: 'bg-green-900/40 text-green-400 border-green-800', closed: 'bg-gray-800/60 text-gray-500 border-gray-700' }
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status]}`}>{labels[status][lang]}</span>
}

export default function SuggestionBox({ lang }: { lang: Lang }) {
  const { profile } = useAuth()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [responseStatus, setResponseStatus] = useState<SuggestionStatus>('answered')
  const [saving, setSaving] = useState(false)
  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    // Suggestions ohne Join laden (RLS regelt was sichtbar ist)
    const { data, error: err } = await supabase
      .from('suggestions')
      .select('id, user_id, text, response, responded_at, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setError(null)
    const rows = (data || []) as Suggestion[]

    // Namen nur für Officer/Admin nachladen
    if (isOfficerOrAdmin && rows.length > 0) {
      const userIds = [...new Set(rows.map((r) => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, ingame_name')
        .in('id', userIds)

      const nameMap = new Map<string, string>()
      for (const p of profiles || []) {
        nameMap.set(p.id, p.ingame_name || p.display_name || '—')
      }
      setSuggestions(rows.map((r) => ({ ...r, player_name: nameMap.get(r.user_id) ?? '—' })))
    } else {
      setSuggestions(rows)
    }

    setLoading(false)
  }, [isOfficerOrAdmin])

  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  async function handleSubmit() {
    if (!newText.trim()) return
    setSubmitting(true); setError(null)
    const { error: err } = await supabase.rpc('create_suggestion', { p_text: newText.trim() })
    if (err) setError(err.message)
    else {
      setSuccess(lang === 'de' ? 'Vorschlag eingereicht!' : 'Suggestion submitted!')
      setNewText('')
      fetchSuggestions()
    }
    setSubmitting(false)
  }

  async function handleRespond(id: string) {
    if (!responseText.trim()) return
    setSaving(true); setError(null)
    const { error: err } = await supabase.rpc('respond_to_suggestion', {
      p_suggestion_id: id,
      p_response_text: responseText.trim(),
      p_new_status: responseStatus,
    })
    if (err) setError(err.message)
    else {
      setSuccess(lang === 'de' ? 'Antwort gespeichert!' : 'Response saved!')
      setResponding(null)
      setResponseText('')
      fetchSuggestions()
    }
    setSaving(false)
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const t = {
    title:           { de: 'Vorschläge & Feedback',     en: 'Suggestions & Feedback' },
    tip:             { de: 'Ideen und Verbesserungsvorschläge einreichen. Offiziere und Admins sehen alle Einträge und können antworten.', en: 'Submit ideas and improvement suggestions. Officers and Admins can see all entries and respond.' },
    placeholder:     { de: 'Dein Vorschlag oder Feedback...', en: 'Your suggestion or feedback...' },
    submit:          { de: 'Einreichen',              en: 'Submit' },
    empty:           { de: 'Noch keine Vorschläge.',  en: 'No suggestions yet.' },
    respond:         { de: 'Antworten',               en: 'Respond' },
    editRespond:     { de: '✎ Antwort bearbeiten',    en: '✎ Edit response' },
    cancel:          { de: 'Abbrechen',               en: 'Cancel' },
    save:            { de: 'Speichern',               en: 'Save' },
    responsePh:      { de: 'Antwort eingeben...',     en: 'Enter response...' },
    statusLabel:     { de: 'Status',                  en: 'Status' },
    response:        { de: 'Antwort',                 en: 'Response' },
    yourSuggestions: { de: 'Deine Vorschläge',        en: 'Your Suggestions' },
    allSuggestions:  { de: 'Alle Vorschläge',         en: 'All Suggestions' },
    open:            { de: 'Offen',                   en: 'Open' },
    answered:        { de: 'Beantwortet',             en: 'Answered' },
    closed:          { de: 'Geschlossen',             en: 'Closed' },
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
          {error}<button className="ml-2 text-red-400" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-3 text-sm">
          {success}<button className="ml-2 text-green-400" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* Formular */}
      <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
        <h2 className="text-base font-medium text-gray-300 mb-3 flex items-center gap-1">
          {t.title[lang]}
          <InfoTooltip de={t.tip.de} en={t.tip.en} lang={lang} position="bottom" />
        </h2>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={t.placeholder[lang]}
          rows={3}
          className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newText.trim()}
          className="mt-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {submitting ? '...' : t.submit[lang]}
        </button>
      </section>

      {/* Liste */}
      <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
        <h2 className="text-base font-medium text-gray-300 mb-4">
          {isOfficerOrAdmin ? t.allSuggestions[lang] : t.yourSuggestions[lang]}
        </h2>
        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-gray-500 text-sm">{t.empty[lang]}</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="border border-gray-700 rounded-lg p-4 bg-[#0f1117]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={s.status} lang={lang} />
                    {isOfficerOrAdmin && s.player_name && (
                      <span className="text-xs text-gray-500">{s.player_name}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">{formatDate(s.created_at)}</span>
                </div>
                <p className="text-sm text-gray-200 mb-2">{s.text}</p>
                {s.response && (
                  <div className="bg-teal-900/20 border border-teal-900/40 rounded p-2 mb-2">
                    <p className="text-xs text-teal-400 font-medium mb-0.5">{t.response[lang]}:</p>
                    <p className="text-sm text-gray-300">{s.response}</p>
                  </div>
                )}
                {isOfficerOrAdmin && responding === s.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder={t.responsePh[lang]}
                      rows={2}
                      className="w-full bg-[#161822] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs text-gray-500">{t.statusLabel[lang]}:</label>
                      <select
                        value={responseStatus}
                        onChange={(e) => setResponseStatus(e.target.value as SuggestionStatus)}
                        className="bg-[#0f1117] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                      >
                        <option value="open">{t.open[lang]}</option>
                        <option value="answered">{t.answered[lang]}</option>
                        <option value="closed">{t.closed[lang]}</option>
                      </select>
                      <button
                        onClick={() => handleRespond(s.id)}
                        disabled={saving || !responseText.trim()}
                        className="text-xs bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded px-3 py-1 transition-colors"
                      >
                        {saving ? '...' : t.save[lang]}
                      </button>
                      <button
                        onClick={() => { setResponding(null); setResponseText('') }}
                        className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1"
                      >
                        {t.cancel[lang]}
                      </button>
                    </div>
                  </div>
                )}
                {isOfficerOrAdmin && responding !== s.id && (
                  <button
                    onClick={() => { setResponding(s.id); setResponseText(s.response || ''); setResponseStatus(s.status) }}
                    className="mt-1 text-xs text-teal-400 hover:text-teal-300 border border-teal-900 rounded px-2 py-1"
                  >
                    {s.response ? t.editRespond[lang] : t.respond[lang]}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
