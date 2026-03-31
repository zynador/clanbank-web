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
import MembersTab from '@/components/MembersTab'
import GuidesModal from '@/components/GuidesModal'
import GuidedTour, { TourStep } from '@/components/GuidedTour'
import TourButton from '@/components/TourButton'

type Tab =
  | 'home' | 'deposits' | 'battle' | 'ranking' | 'fcu'
  | 'mitglieder' | 'freigabe' | 'vorschlaege' | 'warnungen' | 'verwaltung'

type UserRole = 'admin' | 'offizier' | 'mitglied'

function buildTourSteps(lang: 'de' | 'en'): TourStep[] {
  const de = lang === 'de'
  return [
    {
      id: 'home-status',
      targetSelector: 'home-status',
      tab: 'home',
      title: de ? '👋 Dein Clanbank-Status' : '👋 Your Clanbank Status',
      body: de ? 'Hier siehst du auf einen Blick ob du mit deinen Einzahlungen aktuell bist. Grün = alles gut. Rot = du hast Rückstand.' : 'Here you can see at a glance whether your deposits are up to date. Green = all good. Red = you are behind.',
      roles: ['admin', 'offizier', 'mitglied'],
    },
    {
      id: 'home-ranking-bank',
      targetSelector: 'home-ranking-bank',
      tab: 'home',
      title: de ? '🏦 Bank-Ranking' : '🏦 Bank Ranking',
      body: de ? 'Die Top 5 Einzahler des Clans auf einen Blick. Klicke auf "→ Mehr" um das vollständige Ranking zu sehen.' : 'The top 5 depositors at a glance. Click "→ More" to see the full ranking.',
      roles: ['admin', 'offizier', 'mitglied'],
    },
    {
      id: 'deposits-add',
      targetSelector: 'deposits-add-btn',
      tab: 'deposits',
      title: de ? '💰 Einzahlung erfassen' : '💰 Record a Deposit',
      body: de ? 'Lade einen Screenshot deiner Transaktion hoch — die KI liest Ressource und Menge automatisch aus. Danach einfach speichern.' : 'Upload a screenshot of your transaction — AI reads resource and amount automatically. Then just save.',
      roles: ['admin', 'offizier', 'mitglied'],
    },
    {
      id: 'fcu-ranking',
      targetSelector: 'fcu-ranking-btn',
      tab: 'fcu',
      title: de ? '🎯 FCU-Gesamtranking' : '🎯 FCU Overall Ranking',
      body: de ? 'Hier findest du alle FCU-Events und das Gesamtranking über alle Events. Klicke auf "Gesamtranking" um deine Punkte zu sehen.' : 'Here you find all FCU events and the overall ranking. Click "Overall Ranking" to see your points.',
      roles: ['admin', 'offizier', 'mitglied'],
    },
    {
      id: 'home-backlog',
      targetSelector: 'home-backlog',
      tab: 'home',
      title: de ? '⚠️ Wand der Schande' : '⚠️ Backlog Wall',
      body: de ? 'Alle Mitglieder mit Einzahlungsrückstand auf einen Blick. Klicke auf eine Kachel für Details zu Ressourcen und Fortschritt.' : 'All members with deposit backlog at a glance. Click a tile for details on resources and progress.',
      roles: ['admin', 'offizier'],
    },
    {
      id: 'members-search',
      targetSelector: 'members-search',
      tab: 'mitglieder',
      title: de ? '👥 Mitgliederverwaltung' : '👥 Member Management',
      body: de ? 'Suche nach Mitgliedern, prüfe ihren Registrierungsstatus und verwalte Rollen, Raidleiter-Flags und Ausnahmestatus.' : 'Search for members, check their registration status and manage roles, raid leader flags and exemptions.',
      roles: ['admin', 'offizier'],
    },
    {
      id: 'fcu-list',
      targetSelector: 'fcu-list',
      tab: 'fcu',
      title: de ? '📋 FCU-Events verwalten' : '📋 Manage FCU Events',
      body: de ? 'Lege neue FCU-Events an, lade Screenshots hoch und bestätige die Ergebnisse nach OCR-Prüfung.' : 'Create new FCU events, upload screenshots and confirm results after OCR review.',
      roles: ['admin', 'offizier'],
    },
    {
      id: 'admin-password-reset',
      targetSelector: 'admin-password-reset',
      tab: 'verwaltung',
      title: de ? '🔑 Passwort zurücksetzen' : '🔑 Reset Password',
      body: de ? 'Setze das Passwort eines Mitglieds direkt in der App und gib es per Discord weiter. Das Mitglied kann es danach selbst ändern.' : "Reset a member's password directly in the app and share it via Discord. The member can change it afterwards.",
      roles: ['admin'],
    },
    {
      id: 'admin-bank-import',
      targetSelector: 'admin-bank-import',
      tab: 'verwaltung',
      title: de ? '📊 Bankstand-Import' : '📊 Bank Import',
      body: de ? 'Importiere historische Einzahlungsdaten aus Excel. Registrierte Spieler werden direkt verbucht, nicht-registrierte landen in der historischen Liste.' : 'Import historical deposit data from Excel. Registered players are booked directly, unregistered ones go into the historical list.',
      roles: ['admin'],
    },
  ]
}

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>
}

function DashboardContent() {
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showGuides, setShowGuides] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [lang, setLang] = useState<'de' | 'en'>('de')
  const [alertsCount, setAlertsCount] = useState(0)
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0)
  const [isRaidleiter, setIsRaidleiter] = useState(false)
  const [lastBattleReportId, setLastBattleReportId] = useState<string | null>(null)

  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'
  const isAdmin = profile?.role === 'admin'
  const isDemo = !!(profile as unknown as Record<string, unknown>)?.is_test
  const canSeeAuszahlungen = isOfficerOrAdmin || isRaidleiter
  const role = (profile?.role as UserRole) ?? 'mitglied'
  const allSteps = buildTourSteps(lang)
  const tourSteps = allSteps.filter(s => s.roles.includes(role))

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
    supabase.from('profiles').select('is_raidleiter').eq('id', profile.id).single()
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
    if (!isOfficerOrAdmin) return
    supabase.from('starter_members').select('id', { count: 'exact', head: true })
      .eq('status', 'claimed_pending')
      .then(({ count }) => {
        if (typeof count === 'number') setPendingClaimsCount(count)
      })
  }, [isOfficerOrAdmin])

  async function checkAndStartTour() {
    if (isDemo) return
    try {
      const { data } = await supabase.rpc('get_or_create_tour_progress')
      const progress = data as { completed: boolean; last_step: number } | null
      if (!progress?.completed) setShowTour(true)
    } catch {}
  }

  async function handleTourComplete() {
    setShowTour(false)
    if (isDemo) return
    try {
      await supabase.rpc('update_tour_progress', { p_last_step: tourSteps.length - 1, p_completed: true })
    } catch {}
  }

  async function handleTourSkip() {
    setShowTour(false)
    if (isDemo) return
    try {
      await supabase.rpc('update_tour_progress', { p_last_step: 0, p_completed: false })
    } catch {}
  }

  function handleWelcomeClose() {
    setShowWelcome(false)
    checkAndStartTour()
  }

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
    home: lang === 'de' ? 'Home' : 'Home',
    deposits: lang === 'de' ? 'Bank' : 'Bank',
    battle: lang === 'de' ? 'Kampfberichte' : 'Battle Reports',
    ranking: lang === 'de' ? 'Ranking' : 'Ranking',
    fcu: lang === 'de' ? 'FCU' : 'FCU',
    mitglieder: lang === 'de' ? 'Mitglieder' : 'Members',
    freigabe: lang === 'de' ? 'Freigaben' : 'Approvals',
    vorschlaege: lang === 'de' ? 'Vorschläge' : 'Suggestions',
    warnungen: lang === 'de' ? 'Warnungen' : 'Warnings',
    verwaltung: lang === 'de' ? 'Admin' : 'Admin',
    logout: lang === 'de' ? 'Abmelden' : 'Sign out',
    upload_title: lang === 'de' ? 'Kampfbericht hochladen' : 'Upload Battle Report',
    payout_title: lang === 'de' ? 'Auszahlungsberechnung' : 'Payout Calculation',
    pending: lang === 'de' ? '⏳ Ausstehende Freigaben' : '⏳ Pending Approvals',
  }

  const tabLabel: Record<Tab, string> = {
    home: t.home, deposits: t.deposits, battle: t.battle, ranking: t.ranking,
    fcu: t.fcu, mitglieder: t.mitglieder, freigabe: t.freigabe,
    vorschlaege: t.vorschlaege, warnungen: t.warnungen, verwaltung: t.verwaltung,
  }

  const tabIcon: Record<Tab, string> = {
    home: '🏠', deposits: '💰', battle: '⚔️', ranking: '🏆', fcu: '🎯',
    mitglieder: '👥', freigabe: '✅', vorschlaege: '💡', warnungen: '⚠️', verwaltung: '⚙️',
  }

  const visibleTabs: Tab[] = [
    'home', 'deposits',
    ...(canSeeAuszahlungen ? ['battle' as Tab] : []),
    'ranking', 'fcu',
    ...(isOfficerOrAdmin ? ['mitglieder' as Tab] : []),
    ...(isOfficerOrAdmin ? ['freigabe' as Tab] : []),
    'vorschlaege',
    ...(isOfficerOrAdmin ? ['warnungen' as Tab] : []),
    ...(isAdmin ? ['verwaltung' as Tab] : []),
  ]

  function badgeFor(tab: Tab): number {
    if (tab === 'warnungen') return alertsCount
    if (tab === 'mitglieder') return pendingClaimsCount
    return 0
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="relative group">
            <button onClick={() => navigate('home')} className="flex items-center">
              <Logo />
            </button>
            <div className="absolute left-0 top-full mt-1 px-2 py-1 rounded bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {lang === 'de' ? 'Zur Startseite' : 'Go to Home'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.ingame_name && (
              <span className="text-xs text-gray-400 truncate max-w-[120px]">{'👤 ' + profile.ingame_name}</span>
            )}
            <button onClick={() => setShowGuides(true)} className="text-xs text-gray-400 hover:text-teal-400 px-2 py-1 rounded border border-gray-700 hover:border-teal-600 transition-colors">
              {'📚'}
            </button>
            <a href="/demo" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-teal-400 px-2 py-1 rounded border border-gray-700 hover:border-teal-600 transition-colors">{'🎬'}</a>
            <button onClick={toggleLang} className="text-xs text-gray-400 hover:text-teal-400 px-2 py-1 rounded border border-gray-700 hover:border-teal-600">
              {'🌐 ' + (lang === 'de' ? 'EN' : 'DE')}
            </button>
            <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded border border-gray-700 hover:border-red-600">
              {'🚪'}
            </button>
            <button onClick={() => setDrawerOpen(true)} className="flex flex-col gap-1 p-2 rounded hover:bg-gray-800" aria-label="Menü öffnen">
              <span className="block w-5 h-0.5 bg-gray-300"></span>
              <span className="block w-5 h-0.5 bg-gray-300"></span>
              <span className="block w-5 h-0.5 bg-gray-300"></span>
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center gap-2">
          <span className="text-sm text-gray-400">{tabIcon[activeTab] + ' ' + tabLabel[activeTab]}</span>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div className="w-64 bg-[#161822] border-r border-gray-700 flex flex-col h-full overflow-y-auto">
            <div className="px-4 pt-5 pb-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-900 flex items-center justify-center text-sm font-medium text-teal-300">
                  {(profile?.ingame_name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{profile?.ingame_name ?? profile?.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {visibleTabs.map(tab => {
                const badge = badgeFor(tab)
                return (
                  <button key={tab} onClick={() => navigate(tab)} className={'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ' + (activeTab === tab ? 'bg-teal-900/40 text-teal-300 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')}>
                    <span className="flex items-center gap-2.5">
                      <span>{tabIcon[tab]}</span>
                      <span>{tabLabel[tab]}</span>
                    </span>
                    {badge > 0 && (
                      <span className="bg-red-900/60 text-red-400 border border-red-800 text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
                    )}
                  </button>
                )
              })}
            </nav>
            <div className="px-2 py-3 border-t border-gray-700 space-y-0.5">
              <button onClick={() => { setDrawerOpen(false); setShowGuides(true) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                <span>{'📚'}</span><span>{lang === 'de' ? 'Guides' : 'Guides'}</span>
              </button>
              {!isDemo && (
                <button onClick={() => { setDrawerOpen(false); setShowTour(true) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                  <span>{'🗺️'}</span><span>{lang === 'de' ? 'Tour starten' : 'Start Tour'}</span>
                </button>
              )}
              <button onClick={() => { setDrawerOpen(false); setShowWelcome(true) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                <span>{'❓'}</span><span>{lang === 'de' ? 'Hilfe' : 'Help'}</span>
              </button>
              <button onClick={() => signOut()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400">
                <span>{'🚪'}</span><span>{t.logout}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <main className="max-w-2xl mx-auto">
        {activeTab === 'home' && <HomeTab lang={lang} onNavigate={(tab) => navigate(tab as Tab)} />}
        {activeTab === 'deposits' && <DepositsTab lang={lang} />}
        {activeTab === 'battle' && canSeeAuszahlungen && (
          <div className="space-y-6 p-4">
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-medium text-gray-300 mb-4 flex items-center gap-2">
                {'📋 ' + t.upload_title}
                {isRaidleiter && !isOfficerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">{'⚔️ Raidleiter'}</span>
                )}
              </h2>
              <BattleReportUpload lang={lang} onComplete={(id) => setLastBattleReportId(id)} />
            </section>
            <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-medium text-gray-300 mb-4">{'💰 ' + t.payout_title}</h2>
              <PayoutCalculation lang={lang} />
            </section>
          </div>
        )}
        {activeTab === 'ranking' && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <RankingTab lang={lang} />
          </section>
        )}
        {activeTab === 'fcu' && <FCUEventTab lang={lang} />}
        {activeTab === 'mitglieder' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <h2 className="text-base font-medium text-gray-300 mb-4">{'👥 ' + t.mitglieder}</h2>
            <MembersTab lang={lang} />
          </section>
        )}
        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <h2 className="text-base font-medium text-gray-300 mb-4">{t.pending}</h2>
            <ApprovalQueue />
          </section>
        )}
        {activeTab === 'vorschlaege' && <SuggestionBox lang={lang} />}
        {activeTab === 'warnungen' && isOfficerOrAdmin && (
          <section className="bg-[#161822] border border-gray-800 rounded-xl m-4 p-5">
            <SecurityAlerts lang={lang} onCountChange={(n) => setAlertsCount(n)} />
          </section>
        )}
        {activeTab === 'verwaltung' && isAdmin && <AdminPanel />}
      </main>

      <WelcomeModal role={role} isOpen={showWelcome} onClose={handleWelcomeClose} />
      <HelpButton onClick={() => setShowWelcome(true)} lang={lang} />
      {showGuides && <GuidesModal lang={lang} onClose={() => setShowGuides(false)} />}
      {showTour && tourSteps.length > 0 && (
        <GuidedTour steps={tourSteps} lang={lang} onNavigate={(tab) => navigate(tab as Tab)} onComplete={handleTourComplete} onSkip={handleTourSkip} />
      )}
      {!isDemo && !showTour && <TourButton onClick={() => setShowTour(true)} lang={lang} />}
    </div>
  )
}
