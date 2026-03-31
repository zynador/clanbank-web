'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    description: 'Voller Zugriff auf alle Funktionen der Clanbank.',
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
  const router = useRouter()
  const [loading, setLoading] = useState<DemoRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRoleSelect(role: DemoRole) {
    setLoading(role)
    setError(null)
    try {
      const res = await fetch('/api/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Login fehlgeschlagen.')
        setLoading(null)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.')
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9' }}
      className="flex flex-col items-center justify-center p-6">

      {/* Logo + Headline */}
      <div className="text-center mb-10">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{'🏦'}</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>
          Clanbank kennenlernen
        </h1>
        <p style={{ color: '#94a3b8', maxWidth: '480px', lineHeight: 1.6 }}>
          Wähle eine Rolle und erkunde die Clanbank mit Beispieldaten.
          Kein Login, kein Code — einfach klicken und loslegen.
        </p>
      </div>

      {/* Fehlermeldung */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1.25rem',
          color: '#fca5a5',
          marginBottom: '1.5rem',
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
        }}>
          {'⚠️ ' + error}
        </div>
      )}

      {/* Rollenkarten */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        width: '100%',
        maxWidth: '760px',
        marginBottom: '2.5rem',
      }}>
        {ROLE_CARDS.map((card) => (
          <button
            key={card.role}
            onClick={() => handleRoleSelect(card.role)}
            disabled={loading !== null}
            style={{
              backgroundColor: loading === card.role ? '#1e3a5f' : '#1e293b',
              border: '1px solid ' + (loading === card.role ? '#3b82f6' : '#334155'),
              borderRadius: '1rem',
              padding: '1.5rem',
              textAlign: 'left',
              cursor: loading !== null ? 'not-allowed' : 'pointer',
              opacity: loading !== null && loading !== card.role ? 0.5 : 1,
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{card.emoji}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.4rem' }}>
              {loading === card.role ? 'Wird geladen…' : card.label}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.5 }}>
              {card.description}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {card.features.map((f) => (
                <li key={f} style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                  {'✓ ' + f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* Footer */}
      <p style={{ color: '#475569', fontSize: '0.85rem' }}>
        {'Bereits Mitglied? '}
        <a href="/login" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          Zur Anmeldung
        </a>
      </p>
    </div>
  )
}
