'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import ScreenshotUpload from '@/components/ScreenshotUpload'
import InfoTooltip from '@/components/InfoTooltip'

type Lang = 'de' | 'en'
type Side = 'attacker' | 'defender'

interface DetailScreen {
  url: string
  hash: string
}

interface Props {
  lang: Lang
  onComplete?: (battleReportId: string) => void
}

function getKwFromDate(val: string): { kw: number; year: number } {
  const date = new Date(val)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const kw = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { kw, year: d.getUTCFullYear() }
}

export default function BattleReportUpload({ lang, onComplete }: Props) {
  const { profile } = useAuth()

  const [isRaidleiter, setIsRaidleiter] = useState(false)
  const [step, setStep] = useState<'overview' | 'details' | 'done'>('overview')
  const [battleReportId, setBattleReportId] = useState<string | null>(null)

  // Overview
  const [overviewUrl, setOverviewUrl] = useState<string | null>(null)
  const [overviewHash, setOverviewHash] = useState<string | null>(null)
  const [battleDateStr, setBattleDateStr] = useState('')
  const [battleKw, setBattleKw] = useState<number>(1)
  const [battleYear, setBattleYear] = useState<number>(new Date().getFullYear())
  const [side, setSide] = useState<Side>('attacker')

  // Detail screens
  const [detailScreens, setDetailScreens] = useState<DetailScreen[]>([])
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingHash, setPendingHash] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'

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
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 5000)
      return () => clearTimeout(t)
    }
  }, [feedback])

  function handleDateChange(val: string) {
    setBattleDateStr(val)
    if (val) {
      const { kw, year } = getKwFromDate(val)
      setBattleKw(kw)
      setBattleYear(year)
    }
  }

  async function handleCreateReport() {
    if (!profile?.clan_id || !overviewUrl || !overviewHash || !battleDateStr) {
      setFeedback({ type: 'error', text: 'Fehlende Daten: ' + (!profile?.clan_id ? 'clan_id fehlt' : !overviewUrl ? 'kein Screenshot' : !overviewHash ? 'kein Hash' : 'kein Datum') })
      return
    }
    setSaving(true)
    setFeedback(null)

    const { data: dup } = await supabase.rpc('check_battle_screenshot_hash', { p_hash: overviewHash })
    if (dup?.exists) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Dieser Screenshot wurde bereits hochgeladen.' : 'This screenshot has already been uploaded.' })
      setSaving(false)
      return
    }

    const { data, error } = await supabase.rpc('create_battle_report', {
      p_battle_date:     new Date(battleDateStr).toISOString(),
      p_battle_kw:       battleKw,
      p_battle_year:     battleYear,
      p_side:            side,
      p_screenshot_url:  overviewUrl,
      p_screenshot_hash: overviewHash,
    })

    if (error || !data?.success) {
      setFeedback({ type: 'error', text: data?.message || error?.message || 'Fehler' })
      setSaving(false)
      return
    }

    setBattleReportId(data.id)
    setStep('details')
    setFeedback({
      type: 'success',
      text: lang === 'de'
        ? 'Kampfbericht angelegt (ID: ' + data.id.slice(0, 8) + '...). Jetzt Detail-Screens hochladen.'
        : 'Battle report created. Now upload detail screens.',
    })
    setSaving(false)
  }

  async function handleAddScreen() {
    if (!battleReportId || !pendingUrl || !pendingHash) return
    setSaving(true)
    setFeedback(null)

    const { data: dup } = await supabase.rpc('check_battle_screenshot_hash', { p_hash: pendingHash })
    if (dup?.exists) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Dieser Screenshot wurde bereits hochgeladen.' : 'This screenshot has already been uploaded.' })
      setSaving(false)
      return
    }

    const { data, error } = await supabase.rpc('add_battle_screen', {
      p_battle_report_id: battleReportId,
      p_screenshot_url:   pendingUrl,
      p_screenshot_hash:  pendingHash,
    })

    if (error || !data?.success) {
      setFeedback({ type: 'error', text: data?.message || error?.message || 'Fehler' })
      setSaving(false)
      return
    }

    setDetailScreens(prev => [...prev, { url: pendingUrl, hash: pendingHash }])
    setPendingUrl(null)
    setPendingHash(null)
    setFeedback({
      type: 'success',
      text: lang === 'de'
        ? 'Screen ' + (detailScreens.length + 1) + ' hinzugefügt.'
        : 'Screen ' + (detailScreens.length + 1) + ' added.',
    })
    setSaving(false)
  }

  function handleFinish() {
    if (!battleReportId || detailScreens.length === 0) {
      setFeedback({
        type: 'error',
        text: lang === 'de' ? 'Mindestens ein Detail-Screen erforderlich.' : 'At least one detail screen is required.',
      })
      return
    }
    setStep('done')
    if (onComplete && battleReportId) onComplete(battleReportId)
  }

  function reset() {
    setStep('overview')
    setBattleReportId(null)
    setOverviewUrl(null)
    setOverviewHash(null)
    setBattleDateStr('')
    setBattleKw(1)
    setBattleYear(new Date().getFullYear())
    setSide('attacker')
    setDetailScreens([])
    setPendingUrl(null)
    setPendingHash(null)
    setFeedback(null)
  }

  const canUse = isOfficerOrAdmin || isRaidleiter
  const kwOptions = Array.from({ length: 53 }, (_, i) => i + 1)

  if (!canUse) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <p className="text-sm text-zinc-500">
          {lang === 'de'
            ? 'Nur Raidleiter, Offiziere und Admins können Kampfberichte hochladen.'
            : 'Only raid leaders, officers and admins can upload battle reports.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Feedback */}
      {feedback && (
        <div className={'px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-2 ' + (
          feedback.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        )}>
          <span>{feedback.text}</span>
          <button className="opacity-60 hover:opacity-100 shrink-0" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className={step === 'overview' ? 'text-blue-400 font-medium' : (step === 'details' || step === 'done') ? 'text-zinc-500 line-through' : 'text-zinc-600'}>
          1. {lang === 'de' ? 'Übersicht' : 'Overview'}
        </span>
        <span className="text-zinc-700">→</span>
        <span className={step === 'details' ? 'text-blue-400 font-medium' : step === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-600'}>
          2. {lang === 'de' ? 'Details' : 'Details'}
        </span>
        <span className="text-zinc-700">→</span>
        <span className={step === 'done' ? 'text-green-400 font-medium' : 'text-zinc-600'}>
          3. {lang === 'de' ? 'Fertig' : 'Done'}
        </span>
      </div>

      {/* ── STEP 1: Übersichts-Screen ── */}
      {step === 'overview' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
            📋 {lang === 'de' ? 'Übersichts-Screen' : 'Overview Screen'}
            <InfoTooltip
              de="Lade den Übersichts-Screen des Kampfberichts hoch. Pflichtfeld — muss zuerst hochgeladen werden. OCR-Erkennung von Datum und Seite folgt in Schritt 4."
              en="Upload the battle report overview screen. Required — must be uploaded first. OCR date/side detection will be added in step 4."
              lang={lang}
              position="bottom"
            />
          </h3>

          {/* Screenshot */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1">
              {lang === 'de' ? 'Übersichts-Screen' : 'Overview screenshot'}
              <span className="text-red-400">*</span>
            </label>
            {profile?.clan_id && (
              <ScreenshotUpload
                key={'detail-' + detailScreens.length}
                clanId={profile.clan_id}
                existingUrl={pendingUrl}
                isOfficerOrAdmin={true}
                onUploadComplete={(url, hash) => {
                  setPendingUrl(url)
                  if (hash) setPendingHash(hash)
                }}
              />
            )}
          </div>

          {/* Kampfdatum */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              {lang === 'de' ? 'Kampfdatum' : 'Battle date'}
              <span className="text-red-400 ml-1">*</span>
              <span className="text-zinc-600 ml-1">
                {lang === 'de' ? '(wird später per OCR automatisch erkannt)' : '(will be auto-detected via OCR later)'}
              </span>
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={battleDateStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              />
              {battleDateStr && (
                <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded">
                  {'KW ' + battleKw + ' / ' + battleYear}
                </span>
              )}
            </div>
          </div>

          {/* KW override + Seite */}
          <div className="flex gap-4 flex-wrap">
            <label className="text-xs text-zinc-500 flex items-center gap-2">
              {lang === 'de' ? 'KW (Korrektur)' : 'Week (override)'}:
              <select
                value={battleKw}
                onChange={(e) => setBattleKw(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                {kwOptions.map(kw => (
                  <option key={kw} value={kw}>{'KW ' + kw}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-zinc-500 flex items-center gap-2">
              {lang === 'de' ? 'Seite' : 'Side'}
              <span className="text-red-400">*</span>
              <InfoTooltip
                de="Angreifer = [1Ca] hat angegriffen. Verteidiger = [1Ca] wurde angegriffen. OCR erkennt das [1Ca]-Kürzel automatisch (folgt in Schritt 4)."
                en="Attacker = [1Ca] attacked. Defender = [1Ca] was attacked. OCR will detect the [1Ca] tag automatically (step 4)."
                lang={lang}
                position="bottom"
              />
              :
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as Side)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                <option value="attacker">{lang === 'de' ? 'Angreifer [1Ca]' : 'Attacker [1Ca]'}</option>
                <option value="defender">{lang === 'de' ? 'Verteidiger [1Ca]' : 'Defender [1Ca]'}</option>
              </select>
            </label>
          </div>

          <button
            onClick={handleCreateReport}
            disabled={saving || !overviewUrl || !battleDateStr}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {saving
              ? (lang === 'de' ? 'Speichern...' : 'Saving...')
              : (lang === 'de' ? 'Kampfbericht anlegen →' : 'Create battle report →')
            }
          </button>
        </div>
      )}

      {/* ── STEP 2: Detail-Screens ── */}
      {step === 'details' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
            🖼️ {lang === 'de' ? 'Detail-Screens' : 'Detail Screens'}
            <InfoTooltip
              de="Lade alle Kampf-Detail-Screens einzeln hoch. Jeder Screen zeigt die Verluste einzelner Spieler. Minimum: 1 Screen."
              en="Upload all battle detail screens one by one. Each screen shows individual player losses. Minimum: 1 screen."
              lang={lang}
              position="bottom"
            />
          </h3>

          {/* Bereits hochgeladene Screens */}
          {detailScreens.length > 0 && (
            <div className="bg-zinc-800/40 rounded-lg px-3 py-2 space-y-1">
              <p className="text-xs text-zinc-500 mb-1">
                {lang === 'de' ? 'Hochgeladene Screens:' : 'Uploaded screens:'}
              </p>
              {detailScreens.map((s, i) => (
                <div key={s.hash} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-green-400">✓</span>
                  <span>{'Screen ' + (i + 1)}</span>
                  <span className="text-zinc-700">{'(' + s.hash.slice(0, 8) + '...)'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Nächster Screen */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              {lang === 'de'
                ? 'Screen ' + (detailScreens.length + 1) + ' hochladen'
                : 'Upload screen ' + (detailScreens.length + 1)
              }
            </label>
            {profile?.clan_id && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                existingUrl={pendingUrl}
                isOfficerOrAdmin={true}
                onUploadComplete={(url, hash) => {
                  setPendingUrl(url)
                  if (hash) setPendingHash(hash)
                }}
              />
            )}
          </div>

          <button
            onClick={handleAddScreen}
            disabled={saving || !pendingUrl}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {saving
              ? (lang === 'de' ? 'Hinzufügen...' : 'Adding...')
              : ('+ ' + (lang === 'de' ? 'Screen hinzufügen' : 'Add screen'))
            }
          </button>

          {/* Abschließen */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 mb-3">
              {lang === 'de'
                ? 'Alle Screens hochgeladen? Dann Bericht abschließen. Die OCR-Analyse und Berechnung folgen im nächsten Tab.'
                : 'All screens uploaded? Then finish the report. OCR analysis and calculation follow in the next tab.'
              }
            </p>
            <button
              onClick={handleFinish}
              disabled={detailScreens.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {'✓ ' + (lang === 'de'
                ? 'Upload abschließen (' + detailScreens.length + ' Screen(s))'
                : 'Finish upload (' + detailScreens.length + ' screen(s))')
              }
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Fertig ── */}
      {step === 'done' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <p className="text-sm font-medium text-green-400">
            {lang === 'de' ? 'Upload abgeschlossen!' : 'Upload complete!'}
          </p>
          <p className="text-xs text-zinc-500">
            {lang === 'de'
              ? detailScreens.length + ' Detail-Screen(s) hochgeladen. OCR-Analyse und Berechnung im Tab "Auszahlungen".'
              : detailScreens.length + ' detail screen(s) uploaded. OCR analysis and calculation in the "Payouts" tab.'
            }
          </p>
          {battleReportId && (
            <p className="text-xs text-zinc-700 font-mono">
              {'ID: ' + battleReportId}
            </p>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            {lang === 'de' ? '+ Neuer Kampfbericht' : '+ New battle report'}
          </button>
        </div>
      )}

    </div>
  )
}
