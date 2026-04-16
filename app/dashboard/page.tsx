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

type Tab = 'home' | 'deposits' | 'battle' | 'ranking' | 'fcu' | 'mitglieder' | 'freigabe' | 'vorschlaege' | 'warnungen' | 'verwaltung'
type UserRole = 'admin' | 'offizier' | 'mitglied'

function buildTourSteps(lang: 'de' | 'en'): TourStep[] {
  const de = lang === 'de'
  return [
    {
      id: 'home-status',
      targetSelector: 'home-status',
      tab: 'home',
      title: de ? '👋 Dein Status' : '👋 Your Status',
      body: de ? 'Hier siehst du auf einen Blick ob du mit deinen Einzahlungen aktuell bist. Grün = alles gut. Rot = du hast Rückstand.' : 'Here you can see at a glance whether your deposits are up to date. Green = all good. Red = you are behind.',
      roles: ['admin', 'offizier', 'mitglied']
    },
    {
      id: 'home-ranking-bank',
      targetSelector: 'home-ranking-bank',
      tab: 'home',
      title: de ? '🏦 Bank-Ranking' : '🏦 Bank Ranking',
      body: de ? 'Die Top 5 Einzahler des Clans auf einen Blick. Klicke auf "→ Mehr" um das vollständige Ranking zu sehen.' : 'The top 5 depositors at a glance. Click "→ More" to see the full ranking.',
      roles: ['admin', 'offizier', 'mitglied']
    },
    {
      id: 'deposits-add',
      targetSelector: 'deposits-add-btn',
      tab: 'deposits',
      title: de ? '💰 Einzahlung erfassen' : '💰 Record a Deposit',
      body: de ? 'Lade einen Screenshot hoch — die KI liest Ressource und Menge automatisch aus.' : 'Upload a screenshot — AI reads resource and amount automatically.',
      roles: ['admin', 'offizier', 'mitglied']
    },
    {
      id: 'fcu-ranking',
      targetSelector: 'fcu-ranking-btn',
      tab: 'fcu',
      title: de ? '🎯 FCU-Gesamtranking' : '🎯 FCU Overall Ranking',
      body: de ? 'Hier findest du alle FCU-Events und das Gesamtranking über alle Events.' : 'Here you find all FCU events and the overall ranking.',
      roles: ['admin', 'offizier', 'mitglied']
    },
    {
      id: 'home-backlog',
      targetSelector: 'home-backlog',
      tab: 'home',
      title: de ? '⚠️ Wand der Schande' : '⚠️ Backlog Wall',
      body: de ? 'Alle Mitglieder mit Einzahlungsrückstand auf einen Blick.' : 'All members with deposit backlog at a glance.',
      roles: ['admin', 'offizier']
    },
    {
      id: 'members-search',
      targetSelector: 'members-search',
      tab: 'mitglieder',
      title: de ? '👥 Mitgliederverwaltung' : '👥 Member Management',
      body: de ? 'Suche nach Mitgliedern, prüfe ihren Status und verwalte Rollen.' : 'Search for members, check their status and manage roles.',
      roles: ['admin', 'offizier']
    },
    {
      id: 'fcu-list',
      targetSelector: 'fcu-list',
      tab: 'fcu',
      title: de ? '📋 FCU-Events verwalten' : '📋 Manage FCU Events',
      body: de ? 'Lege neue FCU-Events an, lade Screenshots hoch und bestätige die Ergebnisse.' : 'Create new FCU events, upload screenshots and confirm results.',
      roles: ['admin', 'offizier']
    },
    {
      id: 'admin-password-reset',
      targetSelector: 'admin-password-reset',
      tab: 'verwaltung',
      title: de ? '🔑 Passwort zurücksetzen' : '🔑 Reset Password',
      body: de ? 'Setze das Passwort eines Mitglieds direkt in der App.' : "Reset a member's password directly in the app.",
      roles: ['admin']
    },
    {
      id: 'admin-bank-import',
      targetSelector: 'admin-bank-import',
      tab: 'verwaltung',
      title: de ? '📊 Bankstand-Import' : '📊 Bank Import',
      body: de ? 'Importiere historische Einzahlungsdaten aus Excel.' : 'Import historical deposit data from Excel.',
      roles: ['admin']
    },
  ]
}

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>
}

// ── Stil-Konstanten ────────────────────────────────────────────────────────────
const G = {
  bg:        '#0C0A08',
  bg2:       '#141008',
  bg3:       '#1C1508',
  border:    'rgba(201,168,76,0.18)',
  borderHi:  'rgba(201,168,76,0.35)',
  gold:      '#E8C87A',
  goldMid:   'rgba(201,168,76,0.55)',
  goldLow:   'rgba(201,168,76,0.3)',
  goldFaint: 'rgba(201,168,76,0.15)',
}

function btnStyle(danger = false) {
  return {
    height: 26,
    padding: '0 8px',
    borderRadius: 6,
    background: G.bg3,
    border: '0.5px solid ' + (danger ? 'rgba(180,60,40,0.25)' : G.border),
    color: danger ? 'rgba(220,80,60,0.55)' : G.goldMid,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  } as React.CSSProperties
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
  const initials = (profile?.ingame_name ?? profile?.username ?? '?').slice(0, 2).toUpperCase()

  useEffect(() => {
    try { const s = localStorage.getItem('clanbank_lang'); if (s === 'en' || s === 'de') setLang(s) } catch {}
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
      .then(({ data }) => { if (data) setIsRaidleiter(!!(data as { is_raidleiter: boolean }).is_raidleiter) })
  }, [profile?.id])

  useEffect(() => {
    if (!isOfficerOrAdmin) return
    supabase.rpc('get_security_alerts_count').then(({ data }) => {
      if (typeof data === 'number') setAlertsCount(data)
    })
  }, [isOfficerOrAdmin])

  useEffect(() => {
    if (!isOfficerOrAdmin) return
    supabase.from('starter_members').select('id', { count: 'exact', head: true }).eq('status', 'claimed_pending')
      .then(({ count }) => { if (typeof count === 'number') setPendingClaimsCount(count) })
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

  function handleWelcomeClose() { setShowWelcome(false); checkAndStartTour() }

  function toggleLang() {
    const next = lang === 'de' ? 'en' : 'de'
    setLang(next)
    try { localStorage.setItem('clanbank_lang', next) } catch {}
  }

  function navigate(tab: Tab) { setActiveTab(tab); setDrawerOpen(false) }

  const t = {
    home:         lang === 'de' ? 'Home' : 'Home',
    deposits:     lang === 'de' ? 'Bank' : 'Bank',
    battle:       lang === 'de' ? 'Kampfberichte' : 'Battle Reports',
    ranking:      'Ranking',
    fcu:          'FCU',
    mitglieder:   lang === 'de' ? 'Mitglieder' : 'Members',
    freigabe:     lang === 'de' ? 'Freigaben' : 'Approvals',
    vorschlaege:  lang === 'de' ? 'Vorschläge' : 'Suggestions',
    warnungen:    lang === 'de' ? 'Warnungen' : 'Warnings',
    verwaltung:   'Admin',
    logout:       lang === 'de' ? 'Abmelden' : 'Sign out',
    upload_title: lang === 'de' ? 'Kampfbericht hochladen' : 'Upload Battle Report',
    payout_title: lang === 'de' ? 'Auszahlungsberechnung' : 'Payout Calculation',
    pending:      lang === 'de' ? '⏳ Ausstehende Freigaben' : '⏳ Pending Approvals',
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
    ...(isOfficerOrAdmin ? ['mitglieder' as Tab, 'freigabe' as Tab] : []),
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
    <div className="min-h-screen" style={{ background: G.bg, color: G.gold, overflowX: 'clip' }}>

      {/* Demo-Banner */}
      {isDemo && (
        <div className="text-white text-xs text-center py-1.5 font-medium tracking-wide bg-teal-700">
          {'🎬 DEMO — ' + (lang === 'de'
            ? 'Alle Daten sind Beispieldaten. Änderungen werden nicht gespeichert.'
            : 'All data is sample data. Changes are not saved.')}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: G.bg }}>

        {/* Zeile 1: Branding + 🌐 + ☰ */}
        <div style={{ borderBottom: '0.5px solid ' + G.border }}>
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
            <button
              onClick={() => navigate('home')}
              className="flex items-center gap-2"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <Logo size={36} />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1">
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: G.goldMid }}>TGM</span>
                  <span style={{ color: G.goldFaint, fontSize: 10 }}>·</span>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: G.gold, letterSpacing: '0.02em' }}>Consigliere</span>
                </div>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 600, color: G.goldMid, letterSpacing: '0.03em' }}>
                  Camorra Elite [1Ca]
                </span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={toggleLang} style={btnStyle()}>
                {'🌐 ' + (lang === 'de' ? 'EN' : 'DE')}
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Menü öffnen"
                style={{ ...btnStyle(), width: 30, padding: '0 6px', flexDirection: 'column', gap: 3 } as React.CSSProperties}
              >
                <span style={{ display: 'block', width: 14, height: 1.5, background: G.goldMid, borderRadius: 1 }} />
                <span style={{ display: 'block', width: 14, height: 1.5, background: G.goldMid, borderRadius: 1 }} />
                <span style={{ display: 'block', width: 14, height: 1.5, background: G.goldMid, borderRadius: 1 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Zeile 2: Spieler + Aktionen */}
        <div style={{ background: '#0A0806', borderBottom: '0.5px solid ' + G.borderHi }}>
          <div className="max-w-2xl mx-auto px-4 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: G.bg3, border: '0.5px solid ' + G.borderHi,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: G.goldMid,
                fontFamily: 'Georgia, serif', flexShrink: 0,
              }}>
                {initials}
              </div>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 600, color: G.goldMid }}>
                {profile?.ingame_name ?? profile?.username ?? ''}
              </span>
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: G.goldLow }}>
                {profile?.role ?? ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowGuides(true)} style={btnStyle()} title="Guides">
                {'📚'}
              </button>
              {!isDemo && (
                <button
                  onClick={() => setShowTour(true)}
                  style={btnStyle()}
                  title={lang === 'de' ? 'Einführungstour starten' : 'Start guided tour'}
                  aria-label={lang === 'de' ? 'Tour starten' : 'Start tour'}
                >
                  {'?'}
                </button>
              )}
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...btnStyle(),
                  textDecoration: 'none',
                  color: 'rgba(30,201,154,0.6)',
                  borderColor: 'rgba(13,158,120,0.25)',
                  background: 'rgba(13,158,120,0.06)',
                } as React.CSSProperties}
              >
                {'🎬 Demo'}
              </a>
              <button onClick={() => signOut()} style={btnStyle(true)} title={t.logout}>
                {'🚪'}
              </button>
            </div>
          </div>
        </div>

        {/* Zeile 3: Aktiver Tab */}
        <div style={{ background: '#090705', borderBottom: '0.5px solid ' + G.border }}>
          <div className="max-w-2xl mx-auto px-4 py-1.5">
            <span style={{ fontSize: 13, color: G.goldMid }}>
              {tabIcon[activeTab] + ' ' + tabLabel[activeTab]}
            </span>
          </div>
        </div>
      </header>

      {/* ── DRAWER ─────────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div className="w-64 flex flex-col h-full overflow-y-auto" style={{ background: '#0E0B07', borderRight: '0.5px solid ' + G.border }}>

            {/* Drawer Header */}
            <div className="px-4 pt-5 pb-4" style={{ borderBottom: '0.5px solid ' + G.border }}>
              <div className="flex items-center gap-3">
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: G.bg3, border: '0.5px solid ' + G.borderHi,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: G.goldMid, fontFamily: 'Georgia, serif',
                }}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: G.gold, fontFamily: 'Georgia, serif' }}>
                    {profile?.ingame_name ?? profile?.username}
                  </p>
                  <p className="text-xs capitalize" style={{ color: G.goldLow }}>{profile?.role}</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {visibleTabs.map(tab => {
                const badge = badgeFor(tab)
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => navigate(tab)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{
                      background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
                      color: isActive ? G.gold : G.goldLow,
                      fontWeight: isActive ? 500 : 400,
                      border: isActive ? '0.5px solid ' + G.border : '0.5px solid transparent',
                    }}
                  >
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

            {/* Drawer Footer */}
            <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '0.5px solid ' + G.border }}>
              <button
                onClick={() => { setDrawerOpen(false); setShowGuides(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                style={{ color: G.goldLow }}
              >
                <span>{'📚'}</span><span>{lang === 'de' ? 'Guides' : 'Guides'}</span>
              </button>
              {!isDemo && (
                <button
                  onClick={() => { setDrawerOpen(false); setShowTour(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                  style={{ color: G.goldLow }}
                >
                  <span>{'🗺️'}</span><span>{lang === 'de' ? 'Tour starten' : 'Start Tour'}</span>
                </button>
              )}
              <button
                onClick={() => { setDrawerOpen(false); setShowWelcome(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                style={{ color: G.goldLow }}
              >
                <span>{'❓'}</span><span>{lang === 'de' ? 'Hilfe' : 'Help'}</span>
              </button>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                style={{ color: 'rgba(220,80,60,0.55)' }}
              >
                <span>{'🚪'}</span><span>{t.logout}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto">
        {activeTab === 'home' && <HomeTab lang={lang} onNavigate={(tab) => navigate(tab as Tab)} />}
        {activeTab === 'deposits' && <DepositsTab lang={lang} />}
        {activeTab === 'battle' && canSeeAuszahlungen && (
          <div className="space-y-6 p-4">
            <section className="rounded-xl p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
              <h2 className="text-base font-medium mb-4 flex items-center gap-2" style={{ color: G.goldMid }}>
                {'📋 ' + t.upload_title}
                {isRaidleiter && !isOfficerOrAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.1)', color: G.goldMid, border: '0.5px solid ' + G.border }}>{'⚔️ Raidleiter'}</span>
                )}
              </h2>
              <BattleReportUpload lang={lang} onComplete={(id) => setLastBattleReportId(id)} />
            </section>
            <section className="rounded-xl p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
              <h2 className="text-base font-medium mb-4" style={{ color: G.goldMid }}>{'💰 ' + t.payout_title}</h2>
              <PayoutCalculation lang={lang} />
            </section>
          </div>
        )}
        {activeTab === 'ranking' && (
          <section className="rounded-xl m-4 p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
            <RankingTab lang={lang} />
          </section>
        )}
        {activeTab === 'fcu' && <FCUEventTab lang={lang} />}
        {activeTab === 'mitglieder' && isOfficerOrAdmin && (
          <section className="rounded-xl m-4 p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
            <h2 className="text-base font-medium mb-4" style={{ color: G.goldMid }}>{'👥 ' + t.mitglieder}</h2>
            <MembersTab lang={lang} />
          </section>
        )}
        {activeTab === 'freigabe' && isOfficerOrAdmin && (
          <section className="rounded-xl m-4 p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
            <h2 className="text-base font-medium mb-4" style={{ color: G.goldMid }}>{t.pending}</h2>
            <ApprovalQueue />
          </section>
        )}
        {activeTab === 'vorschlaege' && <SuggestionBox lang={lang} />}
        {activeTab === 'warnungen' && isOfficerOrAdmin && (
          <section className="rounded-xl m-4 p-5" style={{ background: G.bg2, border: '0.5px solid ' + G.border }}>
            <SecurityAlerts lang={lang} onCountChange={(n) => setAlertsCount(n)} />
          </section>
        )}
        {activeTab === 'verwaltung' && isAdmin && <AdminPanel />}
      </main>

      <WelcomeModal role={role} isOpen={showWelcome} onClose={handleWelcomeClose} />
      <HelpButton onClick={() => setShowWelcome(true)} lang={lang} />
      {showGuides && <GuidesModal lang={lang} onClose={() => setShowGuides(false)} isDemo={isDemo} />}
      {showTour && tourSteps.length > 0 && (
        <GuidedTour
          steps={tourSteps}
          lang={lang}
          onNavigate={(tab) => navigate(tab as Tab)}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  )
}
