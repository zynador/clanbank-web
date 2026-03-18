'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '@/components/ProtectedRoute'
import Dashboard from '@/components/Dashboard'
import AdminPanel from '@/components/AdminPanel'
import ApprovalQueue from '@/components/ApprovalQueue'
import SuggestionBox from '@/components/SuggestionBox'
import SecurityAlerts from '@/components/SecurityAlerts'
import RankingTab from '@/components/RankingTab'
import DepositsTab from '@/components/DepositsTab'
import BacklogWidget from '@/components/BacklogWidget'
import BattleReportUpload from '@/components/BattleReportUpload'
import PayoutCalculation from '@/components/PayoutCalculation'
import Logo from '@/components/Logo'
import WelcomeModal from '@/components/WelcomeModal'
import HelpButton from '@/components/HelpButton'
import InfoTooltip from '@/components/InfoTooltip'

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>
}

function DashboardContent() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ranking' | 'deposits' | 'auszahlungen' | 'freigabe' | 'warnungen' | 'vorschlaege' | 'verwaltung'>('dashboard')
  const [showWelcome, setShowWelcome] = useState(false)
  const [lang, setLang] = useState<'de' | 'en'>('de')
  const [alertsCount, setAlertsCount] = useState(0)
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0)
  const [isRaidleiter, setIsRaidleiter] = useState(false)
  const [lastBattleReportId, setLastBattleReportId] = useState<string | null>(null)
  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'
  const role = (profile?.role as 'admin' | 'offizier' | 'mitglied') ?? 'mitglied'
  const canSeeAuszahlungen = isOfficerOrAdmin || isRaidleiter

  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!profile?.role) return
    try {
      const seen = localStorage.getItem('clanbank_welcome_seen_v2_' + profile.role)
      if (!seen) setShowWelcome(true)
    } catch {}
  }, [profile?.role])

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('profiles')
      .select('is_raidleiter')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) setIsRaidleiter(!!(data as { is_raidleiter: boolean }).is_raidleiter)
      })
  }, [profile?.id])

  useEffect(() => {
    if (!isOfficerOrAdmin) return
    supabase.rpc('get_security_alerts_count').then(({ data }) => {
      if (typeof data === 'number') setAlertsCount(data)
    })
  }, [isOfficerOrAdmin])

  useEffect(() => {
    if (profile?.role !== 'admin') return
    supabase
      .from('starter_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'claimed_pending')
      .then(({ count }) => {
        if (typeof count === 'number') setPendingClaimsCount(count)
      })
  }, [profile?.role])

  function toggleLang() {
    const next = lang === 'de' ? 'en' : 'de'
    setLang(next)
    try { localStorage.setItem('clanbank_lang', next) } catch {}
  }

  const t = {
    deposits:    { de: 'Einzahlungen', en: 'Deposits' },
    ranking:     { de: 'Ranking', en: 'Ranking' },
    auszahlungen: { de: 'Auszahlungen', en: 'Payouts' },
    approvals:   { de: 'Freigaben', en: 'Approvals' },
    warnings:    { de: 'Warnungen', en: 'Warnings' },
    suggestions: { de: 'Vorschläge', en: 'Suggestions' },
    management:  { de: 'Verwaltung', en: 'Management' },
    logout:      { de: 'Abmelden', en: 'Sign out' },
    pendingTitle: { de: '⏳ Ausstehende Freigaben', en: '⏳ Pending Approvals' },
    tip_dashboard: { de: 'Zeigt Gesamtstatistiken deiner Einzahlungen.', en: 'Shows overall statistics of your deposits.' },
    tip_ranking: { de: 'Rangliste aller Clan-Mitglieder mit individuellem Schwellwert und Auszahlungsberechtigung.', en: 'Ranking of all clan members with individual threshold and payout eligibility.' },
    tip_deposits: { de: 'Hier kannst du neue Einzahlungen erfassen. Screenshot hochladen → KI erkennt Werte → bestätigen.', en: 'Here you can record new deposits. Upload screenshot → AI detects values → confirm.' },
    tip_auszahlungen: { de: 'Kampfberichte hochladen, Verluste per OCR auslesen und Auszahlungen berechnen.', en: 'Upload battle reports, read casualties via OCR and calculate payouts.' },
    tip_approvals: { de: 'Manuelle Einzahlungen warten hier auf Prüfung. Als Offizier kannst du sie genehmigen oder ablehnen.', en: 'Manual deposits wait here for review. As an Officer you can approve or reject them.' },
    tip_warnings: { de: 'Duplikat-Versuche werden hier gemeldet.', en: 'Duplicate attempts are reported here.' },
    tip_suggestions: { de: 'Ideen und Verbesserungsvorschläge für den Clan einreichen.', en: 'Submit ideas and improvement suggestions for the clan.' },
    tip_management: { de: 'Spieler-Rollen vergeben, Ingame-Namen und Start-KW verwalten.', en: 'Assign player roles, manage in-game names and start weeks.' },
    upload_title: { de: 'Kampfbericht hochladen', en: 'Upload Battle Report' },
    payout_title: { de: 'Auszahlungsberechnung', en: 'Payout Calculation' },
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <button onClick={toggleLang} title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'} className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-teal-600">
              🌐 {lang === 'de' ? 'EN' : 'DE'}
            </button>
            <button onClick={() => setShowWelcome(true)} title={lang === 'de' ? 'Anleitung öffnen' : 'Open guide'} className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-teal-600">
              ❓ {lang === 'de' ? 'Hilfe' : 'Help'}
            </button>
            <span className="text-sm text-gray-400 hidden sm:block">
              {profile?.ingame_name || profile?.username}
              <span className="ml-2 text-xs text-gray-600 capitalize">({profile?.role})</span>
            </span>
            <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
              {t.logout[lang]}
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 flex-wrap overflow-visible">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
            Dashboard
            <InfoTooltip de={t.tip_dashboard.de} en={t.tip_dashboard.en} lang={lang} position="bottom" />
          </TabButton>
          <TabButton active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')}>
            {t.ranking[lang]}
            <InfoTooltip de={t.tip_ranking.de} en={t.tip_ranking.en} lang={lang} position="bottom" />
          </TabButton>
          <TabButton active={activeTab === 'deposits'} onClick={() => setActiveTab('deposits')}>
            {t.deposits[lang]}
            <InfoTooltip de={t.tip_deposits.de} en={t.tip_deposits.en} lang={lang} position="bottom" />
          </TabButton>
          {canSeeAuszahlungen && (
            <TabButton active={activeTab === 'auszahlungen'} onClick={() => setActiveTab('auszahlungen')}>
              {'⚔️ ' + t.auszahlungen[lang]}
              <InfoTooltip de={t.tip_auszahlungen.de} en={t.tip_auszahlungen.en} lang={lang} position="bottom" />
            </TabButton>
          )}
          {isOfficerOrAdmin && (
            <TabButton active={activeTab === 'freigabe'} onClick={() => setActiveTab('freigabe')}>
              {t.approvals[lang]}
              <InfoTooltip de={t.tip_approvals.de} en={t.tip_approvals.en} lang={lang} position="bottom" />
            </TabButton>
          )}
          {isOfficerOrAdmin && (
            <TabButton active={activeTab === 'warnungen'} onClick={() => setActiveTab('warnungen')}>
              <span className="flex items-center gap-1.5">
                {t.warnings[lang]}
                {alertsCount > 0 && (
                  <span className="bg-red-900/60 text-red-400 border border-red-800 text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none">
                    {alertsCount}
                  </span>
                )}
              </span>
              <InfoTooltip de={t.tip_warnings.de} en={t.tip_warnings.en} lang={lang} position="bottom" />
            </TabButton>
          )}
          <TabButton active={activeTab === 'vorschlaege'} onClick={() => setActiveTab('vorschlaege')}>
            {t.suggestions[lang]}
            <InfoTooltip de={t.tip_suggestions.de} en={t.tip_suggestions.en} lang={lang} position="bottom" />
          </TabButton>
          {profile?.role === 'admin' && (
            <TabButton active={activeTab === 'verwaltung'} onClick={() => setActiveTab('verwaltung')}>
              <span className="flex items-center gap-1.5">
                {t.management[lang]}
                {pendingClaimsCount > 0 && (
                  <span className="bg-amber-900/60 text-amber-400 border border-amber-800 text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none">
                    {pendingClaimsCount}
                  </span>
                )}
              </span>
              <InfoTooltip de={t.tip_management.de} en={t.tip_management.en} lang={lang} position="bottom" />
            </TabButton>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <>
            <BacklogWidget lang={lang} currentUserId={profile?.id} />
            <Dashboard />
          </>
        )}
        {activeTab === 'ranking' && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
            <RankingTab lang={lang} />
          </section>
        )}
        {activeTab === 'deposits' && <DepositsTab lang={lang} />}
        {activeTab === 'auszahlungen' && canSeeAuszahlungen && (
          <div className="space-y-6">
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
              <h2 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
                📋 {t.upload_title[lang]}
                {isRaidleiter && !isOfficerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                    ⚔️ Raidleiter
                  </span>
                )}
              </h2>
              <BattleReportUpload
                lang={lang}
                onComplete={(id) => setLastBattleReportId(id)}
              />
            </section>
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
              <h2 className="text-base font-medium text-gray-300 mb-4">
                💰 {t.payout_title[lang]}
              </h2>
              <PayoutCalculation lang={lang} />
            </section>
          </div>
        )}
        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
            <h2 className="text-base font-medium text-gray-300 mb-4">{t.pendingTitle[lang]}</h2>
            <ApprovalQueue />
          </section>
        )}
        {activeTab === 'warnungen' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
            <SecurityAlerts lang={lang} onCountChange={(n) => setAlertsCount(n)} />
          </section>
        )}
        {activeTab === 'vorschlaege' && <SuggestionBox lang={lang} />}
        {activeTab === 'verwaltung' && profile?.role === 'admin' && <AdminPanel />}
      </main>
      <WelcomeModal role={role} isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
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
      className={'flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' +
        (active ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500 hover:text-gray-300')}
    >
      {children}
    </button>
  )
}
