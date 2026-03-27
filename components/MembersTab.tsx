'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'
import ExemptionModal from '@/components/ExemptionModal'
import ExemptionBadge from '@/components/ExemptionBadge'
import { useExemptions } from '@/hooks/useExemptions'

type Lang = 'de' | 'en'
type FilterType = 'all' | 'active' | 'pending' | 'left' | 'unmatched'

interface MemberEntry {
  source: string
  profile_id: string | null
  starter_id: string | null
  ingame_name: string
  display_name: string | null
  role: string
  is_raidleiter: boolean
  is_test: boolean
  left_clan_at: string | null
  reg_status: string
  has_exemption: boolean
}

const d = (lang: Lang, de: string, en: string) => lang === 'de' ? de : en

const actionBtn = (color: string): React.CSSProperties => ({
  fontSize: '12px',
  padding: '9px 6px',
  textAlign: 'center',
  border: 'none',
  borderRight: '0.5px solid var(--color-border-tertiary)',
  background: 'transparent',
  cursor: 'pointer',
  width: '100%',
  color,
})

function getMatchStatus(m: MemberEntry): 'matched' | 'profile_only' | 'starter_only' {
  if (m.profile_id && m.starter_id) return 'matched'
  if (m.profile_id && !m.starter_id) return 'profile_only'
  return 'starter_only'
}

export default function MembersTab({ lang }: { lang: Lang }) {
  const { profile } = useAuth()
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<'admin' | 'offizier' | 'mitglied'>('mitglied')
  const [editIngame, setEditIngame] = useState('')
  const [originalIngame, setOriginalIngame] = useState('')
  const [editStartKw, setEditStartKw] = useState(2)
  const [editStartYear, setEditStartYear] = useState(2026)
  const [savingEdit, setSavingEdit] = useState(false)
  const [exemptionTarget, setExemptionTarget] = useState<{ id: string; ingameName: string } | null>(null)
  const { getExemptionForUser, refresh: refreshExemptions } = useExemptions()
  const kwOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback(msg); setFeedbackType(type)
    setTimeout(() => setFeedback(''), 3000)
  }

  const loadMembers = async () => {
    if (!profile?.clan_id) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_members_list', { p_clan_id: profile.clan_id })
    if (!error && data) setMembers(data as MemberEntry[])
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [profile?.clan_id])

  const isAdmin = profile?.role === 'admin'
  const isAdminOrOfficer = profile?.role === 'admin' || profile?.role === 'offizier'

  const stats = {
    registered: members.filter(m => !m.left_clan_at && m.reg_status === 'registered').length,
    pending: members.filter(m => !m.left_clan_at && m.reg_status === 'pending').length,
    unreg: members.filter(m => !m.left_clan_at && m.reg_status === 'unclaimed').length,
    left: members.filter(m => !!m.left_clan_at).length,
    unmatched: members.filter(m => !m.left_clan_at && getMatchStatus(m) === 'starter_only').length,
  }

  const filtered = members.filter(m => {
    if (filter === 'active') { if (m.left_clan_at) return false }
    if (filter === 'pending') { if (m.left_clan_at || m.reg_status !== 'pending') return false }
    if (filter === 'left') { if (!m.left_clan_at) return false }
    if (filter === 'unmatched') { if (m.left_clan_at || getMatchStatus(m) !== 'starter_only') return false }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase()
      const nameMatch = m.ingame_name.toLowerCase().includes(s)
      const displayMatch = (m.display_name || '').toLowerCase().includes(s)
      if (!nameMatch && !displayMatch) return false
    }
    return true
  })

  const memberKey = (m: MemberEntry) => m.profile_id || m.starter_id || m.ingame_name

  const roleBadge = (role: string) => {
    if (role === 'admin') return { bg: '#FAECE7', color: '#993C1D', label: 'Admin' }
    if (role === 'offizier') return { bg: '#FAEEDA', color: '#854F0B', label: 'Offizier' }
    return { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', label: d(lang, 'Mitglied', 'Member') }
  }

  const regBadge = (m: MemberEntry) => {
    if (m.left_clan_at) return { bg: 'var(--color-background-danger)', color: 'var(--color-text-danger)', label: d(lang, 'Ausgetreten', 'Left') }
    if (m.reg_status === 'registered') return { bg: 'var(--color-background-success)', color: 'var(--color-text-success)', label: d(lang, '\u2713 Registriert', '\u2713 Registered') }
    if (m.reg_status === 'pending') return { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)', label: d(lang, 'Claim ausstehend', 'Claim pending') }
    return { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', label: d(lang, 'Nicht registriert', 'Not registered') }
  }

  function startEdit(m: MemberEntry) {
    setEditingId(memberKey(m)!)
    setEditRole((m.role as 'admin' | 'offizier' | 'mitglied') ?? 'mitglied')
    setEditIngame(m.ingame_name ?? '')
    setOriginalIngame(m.ingame_name ?? '')
    setEditStartKw(2)
    setEditStartYear(2026)
  }

  const handleUpdateMember = async (m: MemberEntry) => {
    if (!m.profile_id) return
    setSavingEdit(true)
    const updates: Record<string, string> = { role: editRole }
    const trimmed = editIngame.trim()
    if (trimmed !== originalIngame) updates.ingame_name = trimmed
    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', m.profile_id)
    if (updateError) { showMsg(updateError.message, 'error'); setSavingEdit(false); return }
    if (trimmed !== originalIngame && originalIngame) {
      await supabase.from('name_history').insert({ user_id: m.profile_id, old_ingame_name: originalIngame, new_ingame_name: trimmed })
    }
    const { data: kwData } = await supabase.rpc('set_member_start_kw', { p_user_id: m.profile_id, p_start_kw: editStartKw, p_start_year: editStartYear })
    if (kwData && !(kwData as any).success) { showMsg((kwData as any).message, 'error'); setSavingEdit(false); return }
    showMsg(d(lang, 'Mitglied aktualisiert', 'Member updated'))
    setEditingId(null)
    loadMembers()
    setSavingEdit(false)
  }

  const handleRaidleiter = async (m: MemberEntry) => {
    if (!m.profile_id) return
    const { data, error } = await supabase.rpc('set_raidleiter_flag', { p_target_user_id: m.profile_id, p_value: !m.is_raidleiter })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(!m.is_raidleiter ? d(lang, 'Raidleiter gesetzt', 'Raid leader set') : d(lang, 'Raidleiter entfernt', 'Raid leader removed')); loadMembers() }
  }

  const handleMarkLeft = async (m: MemberEntry) => {
    const { data, error } = await supabase.rpc('mark_member_left', { p_profile_id: m.profile_id, p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(d(lang, 'Als ausgetreten markiert', 'Marked as left')); setExpandedId(null); loadMembers() }
  }

  const handleReactivate = async (m: MemberEntry) => {
    const { data, error } = await supabase.rpc('reactivate_member', { p_profile_id: m.profile_id, p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(d(lang, 'Mitglied reaktiviert', 'Member reactivated')); setExpandedId(null); loadMembers() }
  }

  const handleConfirmClaim = async (m: MemberEntry) => {
    if (!m.starter_id) return
    const { data, error } = await supabase.rpc('confirm_starter_claim', { p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(d(lang, 'Claim best\u00e4tigt', 'Claim confirmed')); loadMembers() }
  }

  const handleRejectClaim = async (m: MemberEntry) => {
    if (!m.starter_id) return
    const { data, error } = await supabase.rpc('reject_starter_claim', { p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(d(lang, 'Claim abgelehnt', 'Claim rejected')); loadMembers() }
  }

  const handleAddMember = async () => {
    if (!newName.trim() || !profile?.clan_id) return
    setAdding(true)
    const { data, error } = await supabase.rpc('add_clan_member', { p_clan_id: profile.clan_id, p_ingame_name: newName.trim() })
    if (error || !(data as any)?.success) { showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error') }
    else { showMsg(d(lang, 'Mitglied hinzugef\u00fcgt', 'Member added')); setNewName(''); setShowAddForm(false); loadMembers() }
    setAdding(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 0 2rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {[
          { num: stats.registered, label: d(lang, 'Registriert', 'Registered'), color: 'var(--color-text-success)' },
          { num: stats.pending, label: d(lang, 'Ausstehend', 'Pending'), color: 'var(--color-text-warning)' },
          { num: stats.unreg, label: d(lang, 'Nicht reg.', 'Not reg.'), color: 'var(--color-text-secondary)' },
          { num: stats.left, label: d(lang, 'Ausgetreten', 'Left'), color: 'var(--color-text-danger)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 500, color: s.color }}>{s.num}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Suchfeld */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input
          type="text"
          placeholder={d(lang, '\uD83D\uDD0D Suchen...', '\uD83D\uDD0D Search...')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }}
        />
        {searchTerm !== '' && (
          <button onClick={() => setSearchTerm('')} style={{ fontSize: '13px', padding: '6px 10px', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)' }}>x</button>
        )}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {([
          ['all', d(lang, 'Alle', 'All')],
          ['active', d(lang, 'Aktiv', 'Active')],
          ['pending', d(lang, 'Ausstehend', 'Pending')],
          ['left', d(lang, 'Ausgetreten', 'Left')],
          ['unmatched', d(lang, 'Nicht gematcht', 'Unmatched') + (stats.unmatched > 0 ? ' (' + stats.unmatched + ')' : '')],
        ] as [FilterType, string][]).map(([key, label]) => {
          const isUnmatchedKey = key === 'unmatched'
          const active = filter === key
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              fontSize: '12px', padding: '4px 12px', borderRadius: '99px', cursor: 'pointer',
              border: active ? '1px solid var(--color-border-primary)' : '0.5px solid var(--color-border-secondary)',
              background: active ? 'var(--color-background-primary)' : 'transparent',
              color: isUnmatchedKey && stats.unmatched > 0 ? 'var(--color-text-warning)' : active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}>{label}</button>
          )
        })}
      </div>

      {/* Feedback */}
      {feedback !== '' && (
        <div style={{ padding: '8px 12px', marginBottom: '10px', borderRadius: 'var(--border-radius-md)', fontSize: '13px', background: feedbackType === 'success' ? 'var(--color-background-success)' : 'var(--color-background-danger)', color: feedbackType === 'success' ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{feedback}</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem', fontSize: '13px' }}>
          {d(lang, 'Lade Mitglieder...', 'Loading members...')}
        </div>
      )}

      {/* Cards */}
      {!loading && filtered.map(m => {
        const key = memberKey(m)!
        const isExpanded = expandedId === key
        const isLeft = !!m.left_clan_at
        const rb = roleBadge(m.role)
        const sb = regBadge(m)
        const leftDate = m.left_clan_at ? new Date(m.left_clan_at).toLocaleDateString('de-DE') : ''
        return (
          <div key={key} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', marginBottom: '6px', opacity: isLeft ? 0.65 : 1, overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={() => setExpandedId(isExpanded ? null : key)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isLeft ? 'line-through' : 'none', color: isLeft ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>{m.ingame_name}</div>
                {(m.display_name || isLeft) && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {m.display_name ? '@' + m.display_name : ''}
                    {isLeft ? (m.display_name ? ' \u00b7 ' : '') + d(lang, 'ausgetreten ', 'left ') + leftDate : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Badges inline */}
                <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', background: rb.bg, color: rb.color }}>{rb.label}</span>
                <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', background: sb.bg, color: sb.color }}>{sb.label}</span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{isExpanded ? '\u25b2' : '\u25bc'}</span>
              </div>
            </div>
            {/* Extra Badges (Raidleiter, Ausnahme) */}
            {(m.is_raidleiter || (!isLeft && m.profile_id && getExemptionForUser(m.profile_id))) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 12px 8px' }}>
                {m.is_raidleiter && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: '#FAEEDA', color: '#633806', border: '0.5px solid #EF9F27' }}>
                    {'\u2716 Raidleiter'}
                  </span>
                )}
                {!isLeft && m.profile_id && (
                  <ExemptionBadge exemption={getExemptionForUser(m.profile_id)} showTooltip={true} />
                )}
              </div>
            )}
            {/* Actions */}
            {isExpanded && (
              editingId === key ? (
                <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{d(lang, 'Ingame-Name', 'In-game name')}</label>
                      <input type="text" value={editIngame} onChange={e => setEditIngame(e.target.value)} style={{ fontSize: '13px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{d(lang, 'Rolle', 'Role')}</label>
                        <select value={editRole} onChange={e => setEditRole(e.target.value as 'admin' | 'offizier' | 'mitglied')} style={{ fontSize: '13px' }}>
                          <option value="mitglied">{d(lang, 'Mitglied', 'Member')}</option>
                          <option value="offizier">{d(lang, 'Offizier', 'Officer')}</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Start-KW</label>
                        <select value={editStartKw} onChange={e => setEditStartKw(Number(e.target.value))} style={{ fontSize: '13px' }}>
                          {kwOptions.map(kw => <option key={kw} value={kw}>{'KW ' + kw}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{d(lang, 'Jahr', 'Year')}</label>
                        <select value={editStartYear} onChange={e => setEditStartYear(Number(e.target.value))} style={{ fontSize: '13px' }}>
                          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button onClick={() => handleUpdateMember(m)} disabled={savingEdit} style={{ flex: 1, padding: '8px', fontSize: '13px', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-success)', color: 'var(--color-text-success)' }}>
                        {savingEdit ? '...' : d(lang, 'Speichern', 'Save')}
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)' }}>
                        {d(lang, 'Abbrechen', 'Cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {isLeft ? (
                    <>
                      <button onClick={() => handleReactivate(m)} style={actionBtn('var(--color-text-success)')}>
                        {d(lang, 'Reaktivieren', 'Reactivate')}
                      </button>
                      <button onClick={() => {}} style={actionBtn('var(--color-text-secondary)')}>
                        {d(lang, 'Historie ansehen', 'View history')}
                      </button>
                    </>
                  ) : (
                    <>
                      {m.reg_status === 'pending' && isAdmin && (
                        <>
                          <button onClick={() => handleConfirmClaim(m)} style={actionBtn('var(--color-text-success)')}>
                            {d(lang, 'Claim best\u00e4tigen', 'Confirm claim')}
                          </button>
                          <button onClick={() => handleRejectClaim(m)} style={actionBtn('var(--color-text-danger)')}>
                            {d(lang, 'Claim ablehnen', 'Reject claim')}
                          </button>
                        </>
                      )}
                      {m.profile_id && isAdmin && (
                        <button onClick={() => handleRaidleiter(m)} style={actionBtn(m.is_raidleiter ? 'var(--color-text-danger)' : 'var(--color-text-secondary)')}>
                          {m.is_raidleiter ? d(lang, 'RL entfernen', 'Remove RL') : d(lang, 'RL setzen', 'Set RL')}
                        </button>
                      )}
                      {m.profile_id && isAdminOrOfficer && (
                        <button onClick={() => setExemptionTarget({ id: m.profile_id!, ingameName: m.ingame_name })} style={actionBtn('var(--color-text-warning)')}>
                          {getExemptionForUser(m.profile_id) ? d(lang, 'Ausnahme bearbeiten', 'Edit exemption') : d(lang, '+ Ausnahme', '+ Exemption')}
                        </button>
                      )}
                      {m.profile_id && isAdmin && (
                        <button onClick={() => startEdit(m)} style={actionBtn('var(--color-text-info)')}>
                          {d(lang, 'Bearbeiten', 'Edit')}
                        </button>
                      )}
                      {isAdminOrOfficer && (
                        <button onClick={() => handleMarkLeft(m)} style={actionBtn('var(--color-text-danger)')}>
                          {d(lang, 'Ausgetreten markieren', 'Mark as left')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            )}
          </div>
        )
      })}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem', fontSize: '13px' }}>
          {searchTerm !== '' ? d(lang, 'Keine Ergebnisse f\u00fcr \u201e' + searchTerm + '\u201c', 'No results for "' + searchTerm + '"') : d(lang, 'Keine Eintr\u00e4ge in dieser Kategorie.', 'No entries in this category.')}
        </div>
      )}

      {/* Add Member */}
      {showAddForm ? (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '12px', marginTop: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
            {d(lang, 'Neues Mitglied hinzuf\u00fcgen', 'Add new member')}
          </div>
          <input
            type="text"
            placeholder={d(lang, 'Ingame-Name', 'In-game name')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddMember() }}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleAddMember} disabled={adding || !newName.trim()} style={{ flex: 1, padding: '8px', fontSize: '13px', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-success)', color: 'var(--color-text-success)' }}>
              {adding ? '...' : d(lang, 'Hinzuf\u00fcgen', 'Add')}
            </button>
            <button onClick={() => { setShowAddForm(false); setNewName('') }} style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)' }}>
              {d(lang, 'Abbrechen', 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)} style={{ width: '100%', padding: '10px', marginTop: '4px', fontSize: '13px', cursor: 'pointer', border: '0.5px dashed var(--color-border-secondary)', borderRadius: 'var(--border-radius-lg)', background: 'transparent', color: 'var(--color-text-secondary)' }}>
          {'+ ' + d(lang, 'Neues Mitglied hinzuf\u00fcgen', 'Add new member')}
        </button>
      )}

      {exemptionTarget && (
        <ExemptionModal
          userId={exemptionTarget.id}
          ingameName={exemptionTarget.ingameName}
          onClose={() => { setExemptionTarget(null); refreshExemptions() }}
        />
      )}
    </div>
  )
}
