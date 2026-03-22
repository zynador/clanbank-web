'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminPanel from '@/components/AdminPanel'
import ApprovalQueue from '@/components/ApprovalQueue'
import SuggestionBox from '@/components/SuggestionBox'
import SecurityAlerts from '@/components/SecurityAlerts'
import RankingTab from '@/components/RankingTab'
import DepositsTab from '@/components/DepositsTab'
import BattleReportUpload from '@/components/BattleReportUpload'
import PayoutCalculation from '@/components/PayoutCalculation'
import Logo from '@/components/Logo'
import WelcomeModal from '@/components/WelcomeModal'
import HelpButton from '@/components/HelpButton'
import HomeTab from '@/components/HomeTab'
import FCUEventTab from '@/components/FCUEventTab'

type Tab =
  | 'home'
  | 'deposits'
  | 'battle'
  | 'ranking'
  | 'fcu'
  | 'freigabe'
  | 'vorschlaege'
  | 'warnungen'
  | 'verwaltung'

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>
}

function DashboardContent() {
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [lang, setLang] = useState<'de' | 'en'>('de')
  const [alertsCount, setAlertsCount] = useState(0)
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0)
  const [isRaidleiter, setIsRaidleiter] = useState(false)
  const [lastBattleReportId, setLastBattleReportId] = useState<string | null>(null)

  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'
  const isAdmin = profile?.role === 'admin'
  const canSeeAuszahlungen = isOfficerOrAdmin || isRaidleiter
  const role = (profile?.role as 'admin' | 'offizier' | 'mitglied') ?? 'mitglied'

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
    if (!isAdmin) return
    supabase
      .from('starter_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'claimed_pending')
      .then(({ count }) => {
        if (typeof count === 'number') setPendingClaimsCount(count)
      })
  }, [isAdmin])

  function toggleLang() {
    const next = lang === 'de' ? 'en' : 'de'
    setLang(next)
    try { localStorage.setItem('clanbank_lang', next) } catch {}
  }

  function navigate(tab: Tab) {
    setActiveTab(tab)
    setDrawerOpen(false)
  }

  const t = {
    home:        lang === 'de' ? 'Home'          : 'Home',
    deposits:    lang === 'de' ? 'Bank'           : 'Bank',
    battle:      lang === 'de' ? 'Kampfberichte'  : 'Battle Reports',
    ranking:     lang === 'de' ? 'Ranking'        : 'Ranking',
    fcu:         lang === 'de' ? 'FCU'            : 'FCU',
    freigabe:    lang === 'de' ? 'Freigaben'      : 'Approvals',
    vorschlaege: lang === 'de' ? 'Vorschläge'     : 'Suggestions',
    warnungen:   lang === 'de' ? 'Warnungen'      : 'Warnings',
    verwaltung:  lang === 'de' ? 'Admin'          : 'Admin',
    logout:      lang === 'de' ? 'Abmelden'       : 'Sign out',
    upload_title: lang === 'de' ? 'Kampfbericht hochladen'  : 'Upload Battle Report',
    payout_title: lang === 'de' ? 'Auszahlungsberechnung'   : 'Payout Calculation',
    pending:     lang === 'de' ? '⏳ Ausstehende Freigaben' : '⏳ Pending Approvals',
  }

  const tabLabel: Record<Tab, string> = {
    home:        t.home,
    deposits:    t.deposits,
    battle:      t.battle,
    ranking:     t.ranking,
    fcu:         t.fcu,
    freigabe:    t.freigabe,
    vorschlaege: t.vorschlaege,
    warnungen:   t.warnungen,
    verwaltung:  t.verwaltung,
  }

  const tabIcon: Record<Tab, string> = {
    home:        '🏠',
    deposits:    '💰',
    battle:      '⚔️',
    ranking:     '🏆',
    fcu:         '🎯',
    freigabe:    '✅',
    vorschlaege: '💡',
    warnungen:   '⚠️',
    verwaltung:  '⚙️',
  }

  const visibleTabs: Tab[] = [
    'home',
    'deposits',
    ...(canSeeAuszahlungen ? ['battle' as Tab] : []),
    'ranking',
    'fcu',
    ...(isOfficerOrAdmin ? ['freigabe' as Tab] : []),
    'vorschlaege',
    ...(isOfficerOrAdmin ? ['warnungen' as Tab] : []),
    ...(isAdmin ? ['verwaltung' as Tab] : []),
  ]

  function badgeFor(tab: Tab): number {
    if (tab === 'warnungen') return alertsCount
    if (tab === 'verwaltung') return pendingClaimsCount
    return 0
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">

      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {profile?.ingame_name && (
              <span className="text-xs text-gray-400 truncate max-w-[120px]">
                {'👤 ' + profile.ingame_name}
              </span>
            )}
            <button
              onClick={toggleLang}
              className="text-xs text-gray-400 hover:text-teal-400 px-2 py-1 rounded border border-gray-700 hover:border-teal-600"
            >
              {'🌐 ' + (lang === 'de' ? 'EN' : 'DE')}
            </button>
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded border border-gray-700 hover:border-red-600"
              title={t.logout}
            >
              {'🚪'}
            </button>
            {/* Hamburger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col gap-1 p-2 rounded hover:bg-gray-800"
              aria-label="Menü öffnen"
            >
              <span className="block w-5 h-0.5 bg-gray-300"></span>
              <span className="block w-5 h-0.5 bg-gray-300"></span>
              <span className="block w-5 h-0.5 bg-gray-300"></span>
            </button>
          </div>
        </div>
        {/* Aktiver Tab als Breadcrumb */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {tabIcon[activeTab] + ' ' + tabLabel[activeTab]}
          </span>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 flex">
          {/* Panel */}
          <div className="w-64 bg-[#161822] border-r border-gray-700 flex flex-col h-full overflow-y-auto">

            {/* User Info */}
            <div className="px-4 pt-5 pb-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-900 flex items-center justify-center text-sm font-medium text-teal-300">
                  {(profile?.ingame_name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">
                    {profile?.ingame_name ?? profile?.username}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {visibleTabs.map(tab => {
                const badge = badgeFor(tab)
                return (
                  <button
                    key={tab}
                    onClick={() => navigate(tab)}
                    className={
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ' +
                      (activeTab === tab
                        ? 'bg-teal-900/40 text-teal-300 font-medium'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{tabIcon[tab]}</span>
                      <span>{tabLabel[tab]}</span>
                    </span>
                    {badge > 0 && (
                      <span className="bg-red-900/60 text-red-400 border border-red-800 text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Footer */}
            <div className="px-2 py-3 border-t border-gray-700 space-y-0.5">
              <button
                onClick={() => { setDrawerOpen(false); setShowWelcome(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                <span>{'❓'}</span>
                <span>{lang === 'de' ? 'Hilfe' : 'Help'}</span>
              </button>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400"
              >
                <span>{'🚪'}</span>
                <span>{t.logout}</span>
              </button>
            </div>
          </div>

          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      {/* Hauptinhalt */}
      <main className="max-w-2xl mx-auto">

        {activeTab === 'home' && (
          <HomeTab
            lang={lang}
            onNavigate={(tab) => navigate(tab as Tab)}
          />
        )}

        {activeTab === 'deposits' && (
          <DepositsTab lang={lang} />
        )}

        {activeTab === 'battle' && canSeeAuszahlungen && (
          <div className="space-y-6 p-4">
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
                {'📋 ' + t.upload_title}
                {isRaidleiter && !isOfficerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                    {'⚔️ Raidleiter'}
                  </span>
                )}
              </h2>
              <BattleReportUpload
                lang={lang}
                onComplete={(id) => setLastBattleReportId(id)}
              />
            </section>
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-medium text-gray-300 mb-4">
                {'💰 ' + t.payout_title}
              </h2>
              <PayoutCalculation lang={lang} />
            </section>
          </div>
        )}

        {activeTab === 'ranking' && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <RankingTab lang={lang} />
          </section>
        )}

        {activeTab === 'fcu' && (
          <FCUEventTab lang={lang} />
        )}

        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <h2 className="text-base font-medium text-gray-300 mb-4">{t.pending}</h2>
            <ApprovalQueue />
          </section>
        )}

        {activeTab === 'vorschlaege' && (
          <SuggestionBox lang={lang} />
        )}

        {activeTab === 'warnungen' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <SecurityAlerts lang={lang} onCountChange={(n) => setAlertsCount(n)} />
          </section>
        )}

        {activeTab === 'verwaltung' && isAdmin && (
          <AdminPanel />
        )}

      </main>

      <WelcomeModal role={role} isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      <HelpButton onClick={() => setShowWelcome(true)} lang={lang} />
    </div>
  )
}
