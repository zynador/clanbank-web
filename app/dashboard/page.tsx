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

  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'

  // Automatisch anzeigen beim ersten Login pro Rolle
  useEffect(() => {
    if (!profile?.role) return
    try {
      const seen = localStorage.getItem(`clanbank_welcome_seen_v2_${profile.role}`)
      if (!seen) setShowWelcome(true)
    } catch {}
  }, [profile?.role])

  const role = (profile?.role as 'admin' | 'offizier' | 'mitglied') ?? 'mitglied'

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
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
              Abmelden
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </TabButton>
          <TabButton active={false} onClick={() => router.push('/deposits')}>
            Einzahlungen
          </TabButton>
          {isOfficerOrAdmin && (
            <TabButton active={activeTab === 'freigabe'} onClick={() => setActiveTab('freigabe')}>
              Freigaben
            </TabButton>
          )}
          {profile?.role === 'admin' && (
            <TabButton active={activeTab === 'verwaltung'} onClick={() => setActiveTab('verwaltung')}>
              Verwaltung
            </TabButton>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
            <h2 className="text-base font-medium text-gray-300 mb-4">
              ⏳ Ausstehende Freigaben
            </h2>
            <ApprovalQueue />
          </section>
        )}
        {activeTab === 'verwaltung' && profile?.role === 'admin' && <AdminPanel />}
      </main>

      {/* Anleitung */}
      <WelcomeModal
        role={role}
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
      />
      <HelpButton onClick={() => setShowWelcome(true)} />
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
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-teal-500 text-teal-400'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}
