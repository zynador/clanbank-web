'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import InfoTooltip from '@/components/InfoTooltip'
import StarterMembersPanel from '@/components/StarterMembersPanel'

type Lang = 'de' | 'en'

export default function AdminPanel() {
  const [lang, setLang] = useState<Lang>('de')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  async function handleGenerateCode() {
    setGeneratingCode(true)
    const { data, error } = await supabase.rpc('generate_invite_code')
    if (error) {
      setFeedback({ type: 'error', text: 'Fehler: ' + error.message })
    } else {
      setInviteCode(data as string)
    }
    setGeneratingCode(false)
  }

  const t = {
    code_title:  { de: 'Einladungscode',                   en: 'Invitation Code' },
    active_code: { de: 'Aktiver Clan-Code:',               en: 'Active clan code:' },
    tip_code: {
      de: '⚠️ Normalerweise nicht nötig! Der allgemeine Clan-Code MAFIA2026 ist bereits aktiv und gilt für alle neuen Spieler. Einen neuen Code nur generieren wenn MAFIA2026 kompromittiert wurde.',
      en: '⚠️ Usually not needed! The general clan code MAFIA2026 is already active for all new players. Only generate a new code if MAFIA2026 has been compromised.',
    },
    copy:      { de: 'Kopieren',           en: 'Copy' },
    copied:    { de: 'Code kopiert!',      en: 'Code copied!' },
    generate:  { de: 'Notfall: Neuen Code generieren', en: 'Emergency: Generate new code' },
    generating:{ de: 'Erstelle...',        en: 'Generating...' },
    tip_generate: {
      de: '⚠️ Nur im Notfall nutzen! Für normale Registrierungen einfach den Code MAFIA2026 weitergeben — der funktioniert immer.',
      en: '⚠️ Emergency use only! For normal registrations just share the code MAFIA2026 — that always works.',
    },
  }

  return (
    <div className="space-y-6">

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Einladungscode */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4 flex items-center">
          {t.code_title[lang]}
          <InfoTooltip de={t.tip_code.de} en={t.tip_code.en} lang={lang} position="bottom" />
        </h3>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-zinc-400">{t.active_code[lang]}</span>
          <code className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-lg tracking-widest">
            MAFIA2026
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText('MAFIA2026')
              setFeedback({ type: 'success', text: t.copied[lang] })
            }}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            {'📋 ' + t.copy[lang]}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
            >
              {generatingCode ? t.generating[lang] : t.generate[lang]}
            </button>
            <InfoTooltip de={t.tip_generate.de} en={t.tip_generate.en} lang={lang} position="bottom" />
          </span>

          {inviteCode && (
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-lg tracking-widest">
                {inviteCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode)
                  setFeedback({ type: 'success', text: t.copied[lang] })
                }}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
              >
                {'📋 ' + t.copy[lang]}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Starter-Mitglieder */}
      <StarterMembersPanel lang={lang} />

    </div>
  )
}
