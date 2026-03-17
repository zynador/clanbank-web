'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import InfoTooltip from '@/components/InfoTooltip'
import StarterMembersPanel from '@/components/StarterMembersPanel'
import ExemptionModal from '@/components/ExemptionModal'
import ExemptionBadge from '@/components/ExemptionBadge'
import { useExemptions } from '@/hooks/useExemptions'

type Lang = 'de' | 'en'
type UserRole = 'admin' | 'offizier' | 'mitglied'

interface MemberRow {
  id: string
  username: string
  display_name: string
  ingame_name: string
  role: UserRole
  created_at: string
  start_kw: number
  start_year: number
}

export default function AdminPanel() {
  const [lang, setLang] = useState<Lang>('de')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('mitglied')
  const [editIngame, setEditIngame] = useState('')
  const [originalIngame, setOriginalIngame] = useState('')
  const [editStartKw, setEditStartKw] = useState<number>(2)
  const [editStartYear, setEditStartYear] = useState<number>(2026)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [exemptionTarget, setExemptionTarget] = useState<{ id: string; ingameName: string } | null>(null)
  const { getExemptionForUser, refresh: refreshExemptions } = useExemptions()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  useEffect(() => { fetchMembers() }, [])

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  async function fetchMembers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, ingame_name, role, created_at, start_kw, start_year')
      .order('created_at', { ascending: true })
    if (error) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Fehler beim Laden der Mitglieder.' : 'Error loading members.' })
    } else {
      setMembers((data as MemberRow[]) || [])
    }
    setLoading(false)
  }

  async function handleUpdateMember(memberId: string) {
    setSaving(true)
    setFeedback(null)
    try {
      const updates: Record<string, string> = { role: editRole }
      const trimmedIngame = editIngame.trim()
      if (trimmedIngame !== originalIngame) {
        updates.ingame_name = trimmedIngame
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', memberId)
      if (error) {
        setFeedback({ type: 'error', text: 'Fehler: ' + error.message })
        setSaving(false)
        return
      }
      if (trimmedIngame !== originalIngame && originalIngame) {
        await supabase.from('name_history').insert({
          user_id: memberId,
          old_ingame_name: originalIngame,
          new_ingame_name: trimmedIngame,
        })
      }

      const { data: kwData } = await supabase.rpc('set_member_start_kw', {
        p_user_id: memberId,
        p_start_kw: editStartKw,
        p_start_year: editStartYear,
      })
      if (kwData && !kwData.success) {
        setFeedback({ type: 'error', text: kwData.message })
        setSaving(false)
        return
      }

      setFeedback({ type: 'success', text: lang === 'de' ? 'Mitglied aktualisiert.' : 'Member updated.' })
      setEditingId(null)
      fetchMembers()
    } catch {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Verbindungsfehler beim Speichern.' : 'Connection error while saving.' })
    }
    setSaving(false)
  }

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

  function startEdit(member: MemberRow) {
    setEditingId(member.id)
    setEditRole(member.role)
    setEditIngame(member.ingame_name || '')
    setOriginalIngame(member.ingame_name || '')
    setEditStartKw(member.start_kw ?? 2)
    setEditStartYear(member.start_year ?? 2026)
  }

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    offizier: lang === 'de' ? 'Offizier' : 'Officer',
    mitglied: lang === 'de' ? 'Mitglied' : 'Member',
  }

  const roleBadgeStyles: Record<UserRole, string> = {
    admin:    'bg-red-500/15 text-red-400 border-red-500/20',
    offizier: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    mitglied: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/20',
  }

  const t = {
    code_title:  { de: 'Einladungscode', en: 'Invitation Code' },
    active_code: { de: 'Aktiver Clan-Code:', en: 'Active clan code:' },
    tip_code: {
      de: '⚠️ Normalerweise nicht nötig! Der allgemeine Clan-Code MAFIA2026 ist bereits aktiv und gilt für alle neuen Spieler. Einen neuen Code nur generieren wenn MAFIA2026 kompromittiert wurde.',
      en: '⚠️ Usually not needed! The general clan code MAFIA2026 is already active for all new players. Only generate a new code if MAFIA2026 has been compromised.',
    },
    copy:        { de: 'Kopieren', en: 'Copy' },
    copied:      { de: 'Code kopiert!', en: 'Code copied!' },
    generate:    { de: 'Notfall: Neuen Code generieren', en: 'Emergency: Generate new code' },
    generating:  { de: 'Erstelle...', en: 'Generating...' },
    tip_generate: {
      de: '⚠️ Nur im Notfall nutzen! Für normale Registrierungen einfach den Code MAFIA2026 weitergeben — der funktioniert immer.',
      en: '⚠️ Emergency use only! For normal registrations just share the code MAFIA2026 — that always works.',
    },
    members_title: { de: 'Mitglieder', en: 'Members' },
    tip_members: {
      de: 'Hier kannst du Rollen vergeben, Ingame-Namen aktualisieren und die Start-KW für den persönlichen Schwellwert setzen.',
      en: 'Here you can assign roles, update in-game names and set the start week for the personal threshold.',
    },
    edit:     { de: 'Bearbeiten', en: 'Edit' },
    tip_edit: {
      de: 'Ingame-Namen, Rolle und Start-KW dieses Spielers ändern.',
      en: "Change this player's in-game name, role and start week.",
    },
    ingame:   { de: 'Ingame-Name', en: 'In-game Name' },
    tip_ingame: {
      de: 'Der aktuelle Spielername im Spiel. Bei Änderung wird der alte Name automatisch in der Namenshistorie gespeichert.',
      en: 'The current player name in the game. When changed, the old name is automatically saved in name history.',
    },
    role:     { de: 'Rolle', en: 'Role' },
    tip_role: {
      de: 'Mitglied: nur eigene Einzahlungen. Offizier: sieht alle Einzahlungen + Freigabe-Queue. Admin: voller Zugriff inkl. Verwaltung.',
      en: 'Member: own deposits only. Officer: sees all deposits + approval queue. Admin: full access including management.',
    },
    start_kw: { de: 'Start-KW', en: 'Start week' },
    tip_start_kw: {
      de: 'Kalenderwoche ab der dieser Spieler Einzahlungen schuldet. Bestimmt den persönlichen Schwellwert im Ranking. Beispiel: KW 2 = seit Bankgründung dabei.',
      en: 'Calendar week from which this player owes deposits. Determines the personal threshold in the ranking. Example: week 2 = member since bank founding.',
    },
    start_year: { de: 'Jahr', en: 'Year' },
    save:    { de: 'Speichern', en: 'Save' },
    saving:  { de: 'Speichern...', en: 'Saving...' },
    cancel:  { de: 'Abbrechen', en: 'Cancel' },
  }

  const currentYear = new Date().getFullYear()
  const kwOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

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
            📋 {t.copy[lang]}
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
                📋 {t.copy[lang]}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mitgliederliste */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {t.members_title[lang]} ({members.length})
          </h3>
          <InfoTooltip de={t.tip_members.de} en={t.tip_members.en} lang={lang} position="bottom" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {members.map((member) => (
              <div key={member.id} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">

                      {/* Ingame-Name */}
                      <label className="text-sm text-zinc-400 flex items-center gap-1">
                        {t.ingame[lang]}
                        <InfoTooltip de={t.tip_ingame.de} en={t.tip_ingame.en} lang={lang} position="bottom" />
                        :
                        <input
                          type="text"
                          value={editIngame}
                          onChange={(e) => setEditIngame(e.target.value)}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        />
                      </label>

                      {/* Rolle */}
                      <label className="text-sm text-zinc-400 flex items-center gap-1">
                        {t.role[lang]}
                        <InfoTooltip de={t.tip_role.de} en={t.tip_role.en} lang={lang} position="bottom" />
                        :
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="mitglied">{lang === 'de' ? 'Mitglied' : 'Member'}</option>
                          <option value="offizier">{lang === 'de' ? 'Offizier' : 'Officer'}</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>

                      {/* Start-KW */}
                      <label className="text-sm text-zinc-400 flex items-center gap-1">
                        {t.start_kw[lang]}
                        <InfoTooltip de={t.tip_start_kw.de} en={t.tip_start_kw.en} lang={lang} position="bottom" />
                        :
                        <select
                          value={editStartKw}
                          onChange={(e) => setEditStartKw(Number(e.target.value))}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        >
                          {kwOptions.map(kw => (
                            <option key={kw} value={kw}>KW {kw}</option>
                          ))}
                        </select>
                      </label>

                      {/* Start-Jahr */}
                      <label className="text-sm text-zinc-400 flex items-center gap-1">
                        {t.start_year[lang]}:
                        <select
                          value={editStartYear}
                          onChange={(e) => setEditStartYear(Number(e.target.value))}
                          className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        >
                          {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </label>

                    </div>

                    {/* Schwellwert-Vorschau */}
                    <div className="text-xs text-zinc-500 bg-zinc-800/40 rounded-lg px-3 py-2">
                      {lang === 'de'
                        ? 'Schwellwert-Vorschau: ab KW ' + editStartKw + ' / ' + editStartYear + ' — aktuell KW 13 / 2026'
                        : 'Threshold preview: from week ' + editStartKw + ' / ' + editStartYear + ' — current week 13 / 2026'
                      }
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateMember(member.id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                      >
                        {saving ? t.saving[lang] : t.save[lang]}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
                      >
                        {t.cancel[lang]}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-sm font-medium text-zinc-200">
                          {member.ingame_name || member.display_name}
                        </span>
                        <span className="text-xs text-zinc-500 ml-2">@{member.username}</span>
                        <span className="text-xs text-zinc-600 ml-2">
                          KW {member.start_kw}/{member.start_year}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadgeStyles[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                      <ExemptionBadge exemption={getExemptionForUser(member.id)} />
                    </div>
                    <span className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setExemptionTarget({ id: member.id, ingameName: member.ingame_name || member.display_name })}
                        className="text-xs text-amber-500 hover:text-amber-300 transition-colors"
                      >
                        {getExemptionForUser(member.id) ? '✏️ Ausnahme' : '+ Ausnahme'}
                      </button>
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {t.edit[lang]}
                      </button>
                      <InfoTooltip de={t.tip_edit.de} en={t.tip_edit.en} lang={lang} position="bottom" />
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Starter-Mitglieder */}
      <StarterMembersPanel lang={lang} />

      {/* Ausnahme-Modal */}
      {exemptionTarget && (
        <ExemptionModal
          userId={exemptionTarget.id}
          ingameName={exemptionTarget.ingameName}
          onClose={() => {
            setExemptionTarget(null)
            refreshExemptions()
          }}
        />
      )}

    </div>
  )
}
