'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Logo from '@/components/Logo'

type DemoRole = 'admin' | 'offizier' | 'mitglied'

interface RoleCard {
  role: DemoRole
  label: string
  emoji: string
  description: string
  features: string[]
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: 'admin',
    label: 'Admin',
    emoji: '👑',
    description: 'Voller Zugriff auf alle Funktionen von TGM Consigliere.',
    features: [
      'HomeTab mit Ranking & Status',
      'Bank — alle Einzahlungen',
      'FCU Event-Tracking',
      'Kampfberichte & Auszahlungen',
      'Mitgliederverwaltung',
      'AdminPanel & Import',
      'Wand der Schande',
    ],
  },
  {
    role: 'offizier',
    label: 'Offizier',
    emoji: '⚔️',
    description: 'Zugriff auf alle operativen Bereiche ohne Verwaltungsfunktionen.',
    features: [
      'HomeTab mit Ranking & Status',
      'Bank — alle Einzahlungen',
      'FCU Event-Tracking',
      'Kampfberichte & Auszahlungen',
      'Mitgliederverwaltung',
      'Wand der Schande',
    ],
  },
  {
    role: 'mitglied',
    label: 'Mitglied',
    emoji: '🎮',
    description: 'Die Ansicht für reguläre Clan-Mitglieder.',
    features: [
      'HomeTab mit Ranking & Status',
      'Bank — eigene Einzahlungen',
      'FCU Rangliste',
      'Wand der Schande',
    ],
  },
]

export default function DemoPage() {
  const [loading, setLoading] = useState<DemoRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRole, setHoveredRole] = useState<DemoRole | null>(null)

  async function handleRoleSelect(role: DemoRole) {
    setLoading(role)
    setError(null)
    try {
      const res = await fetch('/api/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || 'Login fehlgeschlagen.')
        setLoading(null)
        return
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (sessionError) {
        setError('Session konnte nicht gesetzt werden.')
        setLoading(null)
        return
      }
      window.location.href = '/dashboard'
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.')
      setLoading(null)
    }
  }

  function getCardBackground(card: RoleCard): string {
    if (loading === card.role) return 'rgba(201,168,76,0.08)'
    if (hoveredRole === card.role && loading === null) return 'rgba(201,168,76,0.08)'
    return '#141008'
  }

  function getCardBorder(card: RoleCard): string {
    if (loading === card.role) return '1px solid rgba(201,168,76,0.45)'
    return '1px solid rgba(201,168,76,0.18)'
  }

  return (
    <div
      style={{ minHeight: '100vh', backgroundColor: '#0C0A08', color: '#E8C87A' }}
      className="flex flex-col items-center justify-center p-6"
    >
      {/* Banner */}
      <div
        className="rounded-xl flex flex-col items-center text-center px-7 pt-9 pb-7 mb-8"
        style={{
          background: '#111111',
          border: '0.5px solid rgba(201,168,76,0.2)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <Logo size={54} />
        <p
          className="mt-4 mb-1 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'rgba(201,168,76,0.45)' }}
        >
          The Grand Mafia
        </p>
        <p
          className="mb-4 font-bold text-3xl tracking-wide"
          style={{ fontFamily: 'Georgia, serif', color: '#E8C87A' }}
        >
          Consigliere
        </p>
        <div
          className="mb-4"
          style={{ width: 40, height: '0.5px', background: 'rgba(201,168,76,0.25)' }}
        />
        <p className="mb-5 text-xs leading-relaxed" style={{ color: '#777570' }}>
          Entdecke TGM Consigliere — kein Login, kein Code.
        </p>
        <div
          className="w-full pt-4 flex flex-col items-center gap-1"
          style={{ borderTop: '0.5px solid rgba(201,168,76,0.12)' }}
        >
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'rgba(201,168,76,0.4)' }}
          >
            powered by
          </span>
          <span
            className="font-bold tracking-wide"
            style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'rgba(201,168,76,0.75)' }}
          >
            Camorra Elite [1Ca]
          </span>
          <span
            className="text-xs italic"
            style={{ fontFamily: 'Georgia, serif', color: 'rgba(201,168,76,0.3)' }}
          >
            Eurer Vicar
          </span>
        </div>
      </div>

      {/* Error Box */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '0.75rem',
            padding: '0.75rem 1.25rem',
            color: '#fca5a5',
            marginBottom: '1.5rem',
            maxWidth: '760px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {'⚠️ ' + error}
        </div>
      )}

      {/* Role Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          width: '100%',
          maxWidth: '760px',
          marginBottom: '2.5rem',
        }}
      >
        {ROLE_CARDS.map((card) => (
          <button
            key={card.role}
            onClick={() => handleRoleSelect(card.role)}
            onMouseEnter={() => setHoveredRole(card.role)}
            onMouseLeave={() => setHoveredRole(null)}
            disabled={loading !== null}
            style={{
              backgroundColor: getCardBackground(card),
              border: getCardBorder(card),
              borderRadius: '1rem',
              padding: '1.5rem',
              textAlign: 'left',
              cursor: loading !== null ? 'not-allowed' : 'pointer',
              opacity: loading !== null && loading !== card.role ? 0.5 : 1,
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{card.emoji}</div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#E8C87A',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {loading === card.role ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '0.9rem',
                      height: '0.9rem',
                      borderRadius: '50%',
                      border: '2px solid rgba(201,168,76,0.3)',
                      borderTopColor: '#C9A84C',
                      animation: 'spin 0.7s linear infinite',
                      flexShrink: 0,
                    }}
                  />
                  <span>{'Wird geladen\u2026'}</span>
                </>
              ) : (
                card.label
              )}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'rgba(201,168,76,0.45)',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}
            >
              {card.description}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {card.features.map((f) => (
                <li
                  key={f}
                  style={{ fontSize: '0.75rem', color: '#C9A84C', marginBottom: '0.2rem' }}
                >
                  {'✓ ' + f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* Footer Link */}
      <p style={{ color: 'rgba(201,168,76,0.3)', fontSize: '0.85rem' }}>
        {'Bereits Mitglied? '}
        <a href="/login" style={{ color: 'rgba(201,168,76,0.6)', textDecoration: 'underline' }}>
          Zur Anmeldung
        </a>
      </p>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
