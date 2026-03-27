'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
import InfoTooltip from '@/components/InfoTooltip'
import StarterMembersPanel from '@/components/StarterMembersPanel'
import BankImportPanel from '@/components/BankImportPanel'
import HistoricalDepositsPanel from '@/components/HistoricalDepositsPanel'

type Lang = 'de' | 'en'
type Member = { id: string; ingame_name: string; display_name: string; is_bank: boolean }

export default function AdminPanel() {
  const { user } = useAuth()
  const [lang, setLang] = useState<Lang>('de')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Passwort-Reset
  const [members, setMembers] = useState<Member[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [resetting, setResetting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Bank-Account Verwaltung
  const [bankTargetId, setBankTargetId] = useState<string>('')
  const [togglingBank, setTogglingBank] = useState(false)

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

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    const { data: clanData } = await supabase.rpc('get_my_clan_id')
    if (!clanData) return
    const { data: testProfiles } = await supabase
      .from('profiles').select('id').eq('clan_id', clanData).eq('is_test', true)
    const excludeIds = new Set((testProfiles ?? []).map((p: any) => p.id))
    const { data, error } = await supabase
      .from('profiles')
      .select('id, ingame_name, display_name, is_bank')
      .eq('clan_id', clanData)
      .is('left_clan_at', null)
      .order('ingame_name')
    if (!error && data) {
      setMembers((data as Member[]).filter(m => !excludeIds.has(m.id)))
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true)
    const { data, error } = await supabase.rpc('generate_invite_code')
    if (error) { setFeedback({ type: 'error', text: 'Fehler: ' + error.message }) }
    else { setInviteCode(data as string) }
    setGeneratingCode(false)
  }

  async function handleResetPassword() {
    if (!selectedUserId || !newPassword || newPassword.length < 6) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Mitglied w\u00e4hlen + Passwort mind. 6 Zeichen.' : 'Select member + password min. 6 chars.' })
      return
    }
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token ?? '') },
        body: JSON.stringify({ targetUserId: selectedUserId, newPassword }),
      })
      const result = await res.json()
      if (result.success) {
        setFeedback({ type: 'success', text: lang === 'de' ? '\u2705 Passwort gesetzt. Bitte an Spieler weitergeben.' : '\u2705 Password set. Share it with the player.' })
        setNewPassword('')
        setSelectedUserId('')
      } else {
        setFeedback({ type: 'error', text: result.message })
      }
    } catch {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Serverfehler.' : 'Server error.' })
    }
    setResetting(false)
  }

  async function handleToggleBank() {
    if (!bankTargetId) return
    setTogglingBank(true)
    const member = members.find(m => m.id === bankTargetId)
    if (!member) { setTogglingBank(false); return }
    const newValue = !member.is_bank
    const { error } = await supabase
      .from('profiles')
      .update({ is_bank: newValue })
      .eq('id', bankTargetId)
    if (error) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Fehler beim Speichern.' : 'Error saving.' })
    } else {
      const label = member.ingame_name || member.display_name
      setFeedback({
        type: 'success',
        text: newValue
          ? (lang === 'de' ? '\uD83C\uDFE6 ' + label + ' als Bank markiert.' : '\uD83C\uDFE6 ' + label + ' marked as bank.')
          : (lang === 'de' ? label + ' ist kein Bank-Account mehr.' : label + ' is no longer a bank account.'),
      })
      setBankTargetId('')
      await loadMembers()
    }
    setTogglingBank(false)
  }

  const bankMembers = members.filter(m => m.is_bank)
  const selectedBankMember = members.find(m => m.id === bankTargetId)

  const t = {
    code_title: { de: 'Einladungscode', en: 'Invitation Code' },
    active_code: { de: 'Aktiver Clan-Code:', en: 'Active clan code:' },
    tip_code: { de: '\u26a0\uFE0F Normalerweise nicht n\u00f6tig! Der allgemeine Clan-Code MAFIA2026 ist bereits aktiv und gilt f\u00fcr alle neuen Spieler. Einen neuen Code nur generieren wenn MAFIA2026 kompromittiert wurde.', en: '\u26a0\uFE0F Usually not needed! The general clan code MAFIA2026 is already active for all new players. Only generate a new code if MAFIA2026 has been compromised.' },
    copy: { de: 'Kopieren', en: 'Copy' },
    copied: { de: 'Code kopiert!', en: 'Code copied!' },
    generate: { de: 'Notfall: Neuen Code generieren', en: 'Emergency: Generate new code' },
    generating: { de: 'Erstelle...', en: 'Generating...' },
    tip_generate: { de: '\u26a0\uFE0F Nur im Notfall nutzen! F\u00fcr normale Registrierungen einfach den Code MAFIA2026 weitergeben \u2014 der funktioniert immer.', en: '\u26a0\uFE0F Emergency use only! For normal registrations just share the code MAFIA2026 \u2014 that always works.' },
    pw_title: { de: 'Passwort zur\u00fccksetzen', en: 'Reset Password' },
    pw_select: { de: 'Mitglied w\u00e4hlen\u2026', en: 'Select member\u2026' },
    pw_label: { de: 'Neues Passwort', en: 'New password' },
    pw_button: { de: 'Passwort setzen', en: 'Set password' },
    pw_setting: { de: 'Setze\u2026', en: 'Setting\u2026' },
    pw_copy: { de: 'Passwort kopieren', en: 'Copy password' },
    pw_tip: { de: 'Setzt das Passwort eines Mitglieds direkt. Das neue Passwort per Discord o.\u00e4. weitergeben. Das Mitglied sollte es danach selbst \u00e4ndern.', en: 'Sets a member\'s password directly. Share the new password via Discord etc. The member should change it afterwards.' },
    bank_title: { de: 'Bank-Accounts', en: 'Bank Accounts' },
    bank_select: { de: 'Mitglied w\u00e4hlen\u2026', en: 'Select member\u2026' },
    bank_mark: { de: 'Als Bank markieren', en: 'Mark as bank' },
    bank_unmark: { de: 'Bank-Status entfernen', en: 'Remove bank status' },
    bank_saving: { de: 'Speichere\u2026', en: 'Saving\u2026' },
    bank_current: { de: 'Aktuelle Bank-Accounts:', en: 'Current bank accounts:' },
    bank_none: { de: 'Keine Bank-Accounts definiert.', en: 'No bank accounts defined.' },
    bank_tip: { de: 'Bank-Accounts (z.B. Bam bamm) erscheinen nicht im Ranking und nicht in der Wand der Schande. Sie k\u00f6nnen weiterhin Einzahlungen t\u00e4tigen, werden aber aus allen Auswertungen ausgeblendet.', en: 'Bank accounts (e.g. Bam bamm) do not appear in rankings or the backlog wall. They can still make deposits but are excluded from all evaluations.' },
  }

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {feedback && (
        <div className={'px-4 py-3 rounded-lg text-sm ' + (feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20')}>
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
          <button onClick={() => { navigator.clipboard.writeText('MAFIA2026'); setFeedback({ type: 'success', text: t.copied[lang] }) }}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
            {'\uD83D\uDCCB ' + t.copy[lang]}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <button onClick={handleGenerateCode} disabled={generatingCode}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
              {generatingCode ? t.generating[lang] : t.generate[lang]}
            </button>
            <InfoTooltip de={t.tip_generate.de} en={t.tip_generate.en} lang={lang} position="bottom" />
          </span>
          {inviteCode && (
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-lg tracking-widest">
                {inviteCode}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(inviteCode); setFeedback({ type: 'success', text: t.copied[lang] }) }}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
                {'\uD83D\uDCCB ' + t.copy[lang]}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Passwort zurücksetzen */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-1">
          {'\uD83D\uDD11 ' + t.pw_title[lang]}
          <InfoTooltip de={t.pw_tip.de} en={t.pw_tip.en} lang={lang} position="bottom" />
        </h3>
        <div className="space-y-3">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-zinc-500">
            <option value="">{t.pw_select[lang]}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.ingame_name || m.display_name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type={showPassword ? 'text' : 'password'} placeholder={t.pw_label[lang]}
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600" />
            <button onClick={() => setShowPassword(v => !v)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm hover:bg-zinc-700 transition-colors">
              {showPassword ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}
            </button>
            {newPassword && (
              <button onClick={() => { navigator.clipboard.writeText(newPassword); setFeedback({ type: 'success', text: t.pw_copy[lang] + ' \u2713' }) }}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm hover:bg-zinc-700 transition-colors">
                {'\uD83D\uDCCB'}
              </button>
            )}
          </div>
          <button onClick={handleResetPassword} disabled={resetting || !selectedUserId || newPassword.length < 6}
            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
            {resetting ? t.pw_setting[lang] : '\uD83D\uDD11 ' + t.pw_button[lang]}
          </button>
        </div>
      </div>

      {/* Bank-Accounts */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-1">
          {'\uD83C\uDFE6 ' + t.bank_title[lang]}
          <InfoTooltip de={t.bank_tip.de} en={t.bank_tip.en} lang={lang} position="bottom" />
        </h3>

        {/* Aktuelle Bank-Accounts anzeigen */}
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">{t.bank_current[lang]}</p>
          {bankMembers.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">{t.bank_none[lang]}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bankMembers.map(m => (
                <span key={m.id} className="text-xs px-2 py-1 rounded-full bg-teal-900/30 text-teal-400 border border-teal-800/40">
                  {'\uD83C\uDFE6 ' + (m.ingame_name || m.display_name)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Toggle */}
        <div className="space-y-3">
          <select value={bankTargetId} onChange={e => setBankTargetId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-zinc-500">
            <option value="">{t.bank_select[lang]}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {(m.is_bank ? '\uD83C\uDFE6 ' : '') + (m.ingame_name || m.display_name)}
              </option>
            ))}
          </select>
          <button
            onClick={handleToggleBank}
            disabled={togglingBank || !bankTargetId}
            className={'w-full px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors ' + (selectedBankMember?.is_bank ? 'bg-red-700 hover:bg-red-600' : 'bg-teal-700 hover:bg-teal-600')}
          >
            {togglingBank
              ? t.bank_saving[lang]
              : selectedBankMember?.is_bank
                ? '\u2716 ' + t.bank_unmark[lang]
                : '\uD83C\uDFE6 ' + t.bank_mark[lang]}
          </button>
        </div>
      </div>

      {/* Starter-Mitglieder */}
      <StarterMembersPanel lang={lang} />

      {/* Bankstand-Import */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <BankImportPanel lang={lang} />
      </div>

      {/* Historische Einzahlungen */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <HistoricalDepositsPanel lang={lang} />
      </div>
    </div>
  )
}
