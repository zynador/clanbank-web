'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import Dashboard from '@/components/Dashboard'
import AdminPanel from '@/components/AdminPanel'
import ApprovalQueue from '@/components/ApprovalQueue'
import Logo from '@/components/Logo'
import WelcomeModal from '@/components/WelcomeModal'
import HelpButton from '@/components/HelpButton'
import InfoTooltip from '@/components/InfoTooltip'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}

function DashboardContent() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'freigabe' | 'verwaltung'>('dashboard')
  const [showWelcome, setShowWelcome] = useState(false)
  const [lang, setLang] = useState<'de' | 'en'>('de')

  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'
  const role = (profile?.role as 'admin' | 'offizier' | 'mitglied') ?? 'mitglied'

  // Sprache aus localStorage laden
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  // Modal beim ersten Login pro Rolle zeigen
  useEffect(() => {
    if (!profile?.role) return
    try {
      const seen = localStorage.getItem(`clanbank_welcome_seen_v2_${profile.role}`)
      if (!seen) setShowWelcome(true)
    } catch {}
  }, [profile?.role])

  function toggleLang() {
    const next = lang === 'de' ? 'en' : 'de'
    setLang(next)
    try { localStorage.setItem('clanbank_lang', next) } catch {}
  }

  const t = {
    deposits:    { de: 'Einzahlungen', en: 'Deposits' },
    approvals:   { de: 'Freigaben',    en: 'Approvals' },
    management:  { de: 'Verwaltung',   en: 'Management' },
    logout:      { de: 'Abmelden',     en: 'Sign out' },
    pendingTitle: { de: '⏳ Ausstehende Freigaben', en: '⏳ Pending Approvals' },
    tip_dashboard: {
      de: 'Zeigt Gesamtstatistiken und die Rangliste aller Clan-Mitglieder. Nur genehmigte Einzahlungen zählen.',
      en: 'Shows overall statistics and the ranking of all clan members. Only approved deposits count.',
    },
    tip_deposits: {
      de: 'Hier kannst du neue Einzahlungen erfassen. Screenshot hochladen → KI erkennt Werte → bestätigen.',
      en: 'Here you can record new deposits. Upload screenshot → AI detects values → confirm.',
    },
    tip_approvals: {
      de: 'Manuelle Einzahlungen warten hier auf Prüfung. Als Offizier kannst du sie genehmigen oder ablehnen.',
      en: 'Manual deposits wait here for review. As an Officer you can approve or reject them.',
    },
    tip_management: {
      de: 'Spieler-Rollen vergeben, Ingame-Namen aktualisieren und Clan-Daten verwalten.',
      en: 'Assign player roles, update in-game names and manage clan data.',
    },
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            {/* DE / EN Umschalter */}
            <button
              onClick={toggleLang}
              title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-teal-600"
            >
              🌐 {lang === 'de' ? 'EN' : 'DE'}
            </button>

            {/* Anleitung öffnen */}
            <button
              onClick={() => setShowWelcome(true)}
              title={lang === 'de' ? 'Anleitung öffnen' : 'Open guide'}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-teal-600"
            >
              ❓ {lang === 'de' ? 'Hilfe' : 'Help'}
            </button>

            <span className="text-sm text-gray-400 hidden sm:block">
              {profile?.ingame_name || profile?.username}
              <span className="ml-2 text-xs text-gray-600 capitalize">
                ({profile?.role})
              </span>
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              {t.logout[lang]}
            </button>
          </div>
        </div>

        {/* Tab-Navigation */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
            Dashboard
            <InfoTooltip de={t.tip_dashboard.de} en={t.tip_dashboard.en} lang={lang} position="bottom" />
          </TabButton>

          <TabButton active={false} onClick={() => router.push('/deposits')}>
            {t.deposits[lang]}
            <InfoTooltip de={t.tip_deposits.de} en={t.tip_deposits.en} lang={lang} position="bottom" />
          </TabButton>

          {isOfficerOrAdmin && (
            <TabButton active={activeTab === 'freigabe'} onClick={() => setActiveTab('freigabe')}>
              {t.approvals[lang]}
              <InfoTooltip de={t.tip_approvals.de} en={t.tip_approvals.en} lang={lang} position="bottom" />
            </TabButton>
          )}

          {profile?.role === 'admin' && (
            <TabButton active={activeTab === 'verwaltung'} onClick={() => setActiveTab('verwaltung')}>
              {t.management[lang]}
              <InfoTooltip de={t.tip_management.de} en={t.tip_management.en} lang={lang} position="bottom" />
            </TabButton>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
            <h2 className="text-base font-medium text-gray-300 mb-4">
              {t.pendingTitle[lang]}
            </h2>
            <ApprovalQueue />
          </section>
        )}
        {activeTab === 'verwaltung' && profile?.role === 'admin' && <AdminPanel />}
      </main>

      <WelcomeModal
        role={role}
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
      />

      {/* Floating Help Button bleibt als Fallback auf kleinen Bildschirmen */}
      <HelpButton onClick={() => setShowWelcome(true)} lang={lang} />
    </div>
  )
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-teal-500 text-teal-400'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}
