'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import InfoTooltip from '@/components/InfoTooltip'

type Lang = 'de' | 'en'
type UserRole = 'admin' | 'offizier' | 'mitglied'

interface MemberRow {
  id: string
  username: string
  display_name: string
  ingame_name: string
  role: UserRole
  created_at: string
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
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      .select('id, username, display_name, ingame_name, role, created_at')
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
      } else {
        if (trimmedIngame !== originalIngame && originalIngame) {
          await supabase.from('name_history').insert({
            user_id: memberId,
            old_ingame_name: originalIngame,
            new_ingame_name: trimmedIngame,
          })
        }
        setFeedback({ type: 'success', text: lang === 'de' ? 'Mitglied aktualisiert.' : 'Member updated.' })
        setEditingId(null)
        fetchMembers()
      }
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
    code_title: { de: 'Einladungscode erstellen', en: 'Create Invitation Code' },
    tip_code: {
      de: '⚠️ Normalerweise nicht nötig! Der allgemeine Clan-Code MAFIA2026 ist bereits aktiv und gilt für alle neuen Spieler. Einen neuen Code nur generieren wenn MAFIA2026 kompromittiert wurde.',
      en: '⚠️ Usually not needed! The general clan code MAFIA2026 is already active for all new players. Only generate a new code if MAFIA2026 has been compromised.',
    },
    generate:   { de: 'Code generieren', en: 'Generate Code' },
    generating: { de: 'Erstelle...', en: 'Generating...' },
    tip_generate: {
      de: '⚠️ Nur im Notfall nutzen! Für normale Registrierungen einfach den Code MAFIA2026 weitergeben — der funktioniert immer.',
      en: '⚠️ Emergency use only! For normal registrations just share the code MAFIA2026 — that always works.',
    },
    copy:   { de: 'Kopieren', en: 'Copy' },
    copied: { de: 'Code kopiert!', en: 'Code copied!' },
    members_title: { de: 'Mitglieder', en: 'Members' },
    tip_members: {
      de: 'Hier kannst du Rollen vergeben und Ingame-Namen aktualisieren. Namensänderungen werden automatisch in der Historie gespeichert.',
      en: 'Here you can assign roles and update in-game names. Name changes are automatically saved in the history.',
    },
    edit:     { de: 'Bearbeiten', en: 'Edit' },
    tip_edit: {
      de: 'Ingame-Namen und Rolle dieses Spielers ändern. Alter Name wird automatisch protokolliert.',
      en: 'Change this player\'s in-game name and role. Old name is automatically logged.',
    },
    ingame:   { de: 'Ingame-Name', en: 'In-game Name' },
    tip_ingame: {
      de: 'Der aktuelle Spielername im Spiel. Bei Änderung wird der alte Name automatisch in der Namenshistorie gespeichert — Einzahlungen bleiben korrekt zugeordnet.',
      en: 'The current player name in the game. When changed, the old name is automatically saved in name history — deposits remain correctly assigned.',
    },
    role:     { de: 'Rolle', en: 'Role' },
    tip_role: {
      de: 'Mitglied: nur eigene Einzahlungen. Offizier: sieht alle Einzahlungen + Freigabe-Queue. Admin: voller Zugriff inkl. Verwaltung.',
      en: 'Member: own deposits only. Officer: sees all deposits + approval queue. Admin: full access including management.',
    },
    save:    { de: 'Speichern', en: 'Save' },
    saving:  { de: 'Speichern...', en: 'Saving...' },
    cancel:  { de: 'Abbrechen', en: 'Cancel' },
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
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center">
          {t.code_title[lang]}
          <InfoTooltip de={t.tip_code.de} en={t.tip_code.en} lang={lang} position="bottom" />
        </h3>
      {/* Dauerhafter MAFIA2026 Code */}
<div className="flex items-center gap-2 mb-4">
  <span className="text-xs text-zinc-400">
    {lang === 'de' ? 'Aktiver Clan-Code:' : 'Active clan code:'}
  </span>
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
        {t.copy[lang]}
      </button>
    </div>
  )}
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
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadgeStyles[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1">
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
    </div>
  )
}
