'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'
type FilterType = 'all' | 'active' | 'pending' | 'left'

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
  fontSize: '12px', padding: '9px 6px', textAlign: 'center',
  border: 'none', borderRight: '0.5px solid var(--color-border-tertiary)',
  background: 'transparent', cursor: 'pointer', width: '100%', color,
})

export default function MembersTab({ lang }: { lang: Lang }) {
  const { profile } = useAuth()
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback(msg)
    setFeedbackType(type)
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
  }

  const filtered = members.filter(m => {
    if (filter === 'active') return !m.left_clan_at
    if (filter === 'pending') return !m.left_clan_at && m.reg_status === 'pending'
    if (filter === 'left') return !!m.left_clan_at
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
    if (m.reg_status === 'registered') return { bg: 'var(--color-background-success)', color: 'var(--color-text-success)', label: d(lang, '✓ Registriert', '✓ Registered') }
    if (m.reg_status === 'pending') return { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)', label: d(lang, 'Claim ausstehend', 'Claim pending') }
    return { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', label: d(lang, 'Nicht registriert', 'Not registered') }
  }

  const handleRaidleiter = async (m: MemberEntry) => {
    if (!m.profile_id) return
    const { data, error } = await supabase.rpc('set_raidleiter_flag', {
      p_profile_id: m.profile_id,
      p_value: !m.is_raidleiter,
    })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(!m.is_raidleiter ? d(lang, 'Raidleiter gesetzt', 'Raid leader set') : d(lang, 'Raidleiter entfernt', 'Raid leader removed'))
      loadMembers()
    }
  }

  const handleMarkLeft = async (m: MemberEntry) => {
    const { data, error } = await supabase.rpc('mark_member_left', {
      p_profile_id: m.profile_id,
      p_starter_id: m.starter_id,
    })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(d(lang, 'Als ausgetreten markiert', 'Marked as left'))
      setExpandedId(null)
      loadMembers()
    }
  }

  const handleReactivate = async (m: MemberEntry) => {
    const { data, error } = await supabase.rpc('reactivate_member', {
      p_profile_id: m.profile_id,
      p_starter_id: m.starter_id,
    })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(d(lang, 'Mitglied reaktiviert', 'Member reactivated'))
      setExpandedId(null)
      loadMembers()
    }
  }

  const handleConfirmClaim = async (m: MemberEntry) => {
    if (!m.starter_id) return
    const { data, error } = await supabase.rpc('confirm_starter_claim', { p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(d(lang, 'Claim bestätigt', 'Claim confirmed'))
      loadMembers()
    }
  }

  const handleRejectClaim = async (m: MemberEntry) => {
    if (!m.starter_id) return
    const { data, error } = await supabase.rpc('reject_starter_claim', { p_starter_id: m.starter_id })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(d(lang, 'Claim abgelehnt', 'Claim rejected'))
      loadMembers()
    }
  }

  const handleAddMember = async () => {
    if (!newName.trim() || !profile?.clan_id) return
    setAdding(true)
    const { data, error } = await supabase.rpc('add_clan_member', {
      p_clan_id: profile.clan_id,
      p_ingame_name: newName.trim(),
    })
    if (error || !(data as any)?.success) {
      showMsg((data as any)?.message || d(lang, 'Fehler', 'Error'), 'error')
    } else {
      showMsg(d(lang, 'Mitglied hinzugefügt', 'Member added'))
      setNewName('')
      setShowAddForm(false)
      loadMembers()
    }
    setAdding(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 0 2rem' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {[
          { num: stats.registered, label: d(lang, 'Registriert', 'Registered'), color: 'var(--color-text-success)' },
          { num: stats.pending,    label: d(lang, 'Ausstehend', 'Pending'),      color: 'var(--color-text-warning)' },
          { num: stats.unreg,      label: d(lang, 'Nicht reg.', 'Not reg.'),     color: 'var(--color-text-secondary)' },
          { num: stats.left,       label: d(lang, 'Ausgetreten', 'Left'),        color: 'var(--color-text-danger)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 500, color: s.color }}>{s.num}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {([
          ['all',     d(lang, 'Alle', 'All')],
          ['active',  d(lang, 'Aktiv', 'Active')],
          ['pending', d(lang, 'Ausstehend', 'Pending')],
          ['left',    d(lang, 'Ausgetreten', 'Left')],
        ] as [FilterType, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            fontSize: '12px', padding: '4px 12px', borderRadius: '99px', cursor: 'pointer',
            border: filter === key ? '1px solid var(--color-border-primary)' : '0.5px solid var(--color-border-secondary)',
            background: filter === key ? 'var(--color-background-primary)' : 'transparent',
            color: filter === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}>{label}</button>
        ))}
      </div>

      {/* Feedback */}
      {feedback !== '' && (
        <div style={{
          padding: '8px 12px', marginBottom: '10px', borderRadius: 'var(--border-radius-md)', fontSize: '13px',
          background: feedbackType === 'success' ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          color: feedbackType === 'success' ? 'var(--color-text-success)' : 'var(--color-text-danger)',
        }}>
          {feedback}
        </div>
      )}

      {/* Loading */}
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
        const initials = m.ingame_name.slice(0, 2).toUpperCase()
        const leftDate = m.left_clan_at ? new Date(m.left_clan_at).toLocaleDateString('de-DE') : ''

        return (
          <div key={key} style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            marginBottom: '8px',
            opacity: isLeft ? 0.65 : 1,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div onClick={() => setExpandedId(isExpanded ? null : key)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: isLeft ? 'var(--color-background-secondary)' : 'var(--color-background-info)',
                color: isLeft ? 'var(--color-text-secondary)' : 'var(--color-text-info)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 500,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '15px', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  textDecoration: isLeft ? 'line-through' : 'none',
                  color: isLeft ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                }}>{m.ingame_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {m.display_name ? '@' + m.display_name : '—'}
                  {isLeft ? ' · ' + d(lang, 'ausgetreten ', 'left ') + leftDate : ''}
                </div>
              </div>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                {isExpanded ? '▲' : '▼'}
              </span>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 12px 10px' }}>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: rb.bg, color: rb.color }}>{rb.label}</span>
              {m.is_raidleiter && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: '#FAEEDA', color: '#633806', border: '0.5px solid #EF9F27' }}>✕ Raidleiter</span>
              )}
              {m.has_exemption && !isLeft && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: '#FAEEDA', color: '#854F0B' }}>{d(lang, 'Ausnahme aktiv', 'Exemption active')}</span>
              )}
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: sb.bg, color: sb.color }}>{sb.label}</span>
            </div>

            {/* Actions */}
            {isExpanded && (
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
                          {d(lang, 'Claim bestätigen', 'Confirm claim')}
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
                    {isAdminOrOfficer && (
                      <button onClick={() => handleMarkLeft(m)} style={actionBtn('var(--color-text-danger)')}>
                        {d(lang, 'Ausgetreten markieren', 'Mark as left')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem', fontSize: '13px' }}>
          {d(lang, 'Keine Einträge in dieser Kategorie.', 'No entries in this category.')}
        </div>
      )}

      {/* Add Member */}
      {showAddForm ? (
        <div style={{
          background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)', padding: '12px', marginTop: '8px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
            {d(lang, 'Neues Mitglied hinzufügen', 'Add new member')}
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
            <button
              onClick={handleAddMember}
              disabled={adding || !newName.trim()}
              style={{
                flex: 1, padding: '8px', fontSize: '13px', cursor: 'pointer',
                borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)',
                background: 'var(--color-background-success)', color: 'var(--color-text-success)',
              }}
            >
              {adding ? '...' : d(lang, 'Hinzufügen', 'Add')}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewName('') }}
              style={{
                padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
                borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)',
                background: 'transparent', color: 'var(--color-text-secondary)',
              }}
            >
              {d(lang, 'Abbrechen', 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            width: '100%', padding: '10px', marginTop: '4px', fontSize: '13px', cursor: 'pointer',
            border: '0.5px dashed var(--color-border-secondary)', borderRadius: 'var(--border-radius-lg)',
            background: 'transparent', color: 'var(--color-text-secondary)',
          }}
        >
          {'+ ' + d(lang, 'Neues Mitglied hinzufügen', 'Add new member')}
        </button>
      )}
    </div>
  )
}
