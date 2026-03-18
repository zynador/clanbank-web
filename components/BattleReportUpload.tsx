'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import ScreenshotUpload from '@/components/ScreenshotUpload'
import InfoTooltip from '@/components/InfoTooltip'

type Lang = 'de' | 'en'
type Side = 'attacker' | 'defender'

interface ScreenSlot {
  url: string | null
  hash: string | null
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

const EMPTY_SLOTS: ScreenSlot[] = Array.from({ length: 6 }, () => ({ url: null, hash: null }))

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

  // Detail screens — 6 Slots
  const [slots, setSlots] = useState<ScreenSlot[]>(EMPTY_SLOTS)
  const [uploadedCount, setUploadedCount] = useState(0)

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

  function updateSlot(index: number, url: string, hash: string | null) {
    setSlots(prev => {
      const next = [...prev]
      next[index] = { url, hash: hash ?? null }
      return next
    })
  }

  async function handleCreateReport() {
    if (!profile?.clan_id || !overviewUrl || !battleDateStr) {
      setFeedback({ type: 'error', text: 'Fehlende Daten: ' + (!profile?.clan_id ? 'clan_id fehlt' : !overviewUrl ? 'kein Screenshot' : 'kein Datum') })
      return
    }
    setSaving(true)
    setFeedback(null)

    if (overviewHash) {
      const { data: dup } = await supabase.rpc('check_battle_screenshot_hash', { p_hash: overviewHash })
      if (dup?.exists) {
        setFeedback({ type: 'error', text: lang === 'de' ? 'Dieser Screenshot wurde bereits hochgeladen.' : 'This screenshot has already been uploaded.' })
        setSaving(false)
        return
      }
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
        ? 'Kampfbericht angelegt. Jetzt Detail-Screens hochladen.'
        : 'Battle report created. Now upload detail screens.',
    })
    setSaving(false)
  }

  async function handleFinish() {
    if (!battleReportId) return
    const filled = slots.filter(s => s.url !== null)
    if (filled.length === 0) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Mindestens ein Detail-Screen erforderlich.' : 'At least one detail screen is required.' })
      return
    }
    setSaving(true)
    setFeedback(null)

    let successCount = 0
    for (const slot of filled) {
      if (!slot.url) continue

      if (slot.hash) {
        const { data: dup } = await supabase.rpc('check_battle_screenshot_hash', { p_hash: slot.hash })
        if (dup?.exists) continue
      }

      const { data, error } = await supabase.rpc('add_battle_screen', {
        p_battle_report_id: battleReportId,
        p_screenshot_url:   slot.url,
        p_screenshot_hash:  slot.hash,
      })
      if (!error && data?.success) successCount++
    }

    setUploadedCount(successCount)
    setSaving(false)

    if (successCount === 0) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Keine Screens konnten hochgeladen werden.' : 'No screens could be uploaded.' })
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
    setSlots(EMPTY_SLOTS)
    setUploadedCount(0)
    setFeedback(null)
  }

  const canUse = isOfficerOrAdmin || isRaidleiter
  const kwOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const filledSlots = slots.filter(s => s.url !== null).length

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
        <span className={step === 'overview' ? 'text-blue-400 font-medium' : 'text-zinc-500 line-through'}>
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
              de="Lade den Übersichts-Screen des Kampfberichts hoch. Pflichtfeld — muss zuerst hochgeladen werden."
              en="Upload the battle report overview screen. Required — must be uploaded first."
              lang={lang}
              position="bottom"
            />
          </h3>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              {lang === 'de' ? 'Übersichts-Screen' : 'Overview screenshot'}
              <span className="text-red-400 ml-1">*</span>
            </label>
            {profile?.clan_id && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                existingUrl={overviewUrl}
                isOfficerOrAdmin={true}
                onUploadComplete={(url, hash) => {
                  setOverviewUrl(url)
                  if (hash) setOverviewHash(hash)
                }}
              />
            )}
          </div>

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
                de="Angreifer = [1Ca] hat angegriffen. Verteidiger = [1Ca] wurde angegriffen."
                en="Attacker = [1Ca] attacked. Defender = [1Ca] was attacked."
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

      {/* ── STEP 2: Detail-Screens Grid ── */}
      {step === 'details' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
            🖼️ {lang === 'de' ? 'Detail-Screens' : 'Detail Screens'}
            <InfoTooltip
              de="Lade bis zu 6 Kampf-Detail-Screens gleichzeitig hoch. Mindestens 1 Screen erforderlich."
              en="Upload up to 6 battle detail screens at once. At least 1 screen required."
              lang={lang}
              position="bottom"
            />
            {filledSlots > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                {filledSlots} {lang === 'de' ? 'bereit' : 'ready'}
              </span>
            )}
          </h3>

          {/* 2×3 Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {slots.map((slot, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-zinc-600">
                  {'Screen ' + (i + 1)}
                  {slot.url && <span className="ml-1 text-green-400">✓</span>}
                </p>
                {profile?.clan_id && (
                  <ScreenshotUpload
                    key={'slot-' + i + '-' + (slot.url ? '1' : '0')}
                    clanId={profile.clan_id}
                    existingUrl={slot.url}
                    isOfficerOrAdmin={true}
                    onUploadComplete={(url, hash) => updateSlot(i, url, hash)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 mb-3">
              {lang === 'de'
                ? 'Alle gewünschten Screens hochgeladen? Dann Bericht abschließen.'
                : 'All desired screens uploaded? Then finish the report.'}
            </p>
            <button
              onClick={handleFinish}
              disabled={saving || filledSlots === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {saving
                ? (lang === 'de' ? 'Wird gespeichert...' : 'Saving...')
                : ('✓ ' + (lang === 'de'
                    ? 'Upload abschließen (' + filledSlots + ' Screen(s))'
                    : 'Finish upload (' + filledSlots + ' screen(s))')
                )
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
              ? uploadedCount + ' Detail-Screen(s) gespeichert. OCR-Analyse und Berechnung unten.'
              : uploadedCount + ' detail screen(s) saved. OCR analysis and calculation below.'}
          </p>
          {battleReportId && (
            <p className="text-xs text-zinc-700 font-mono">{'ID: ' + battleReportId}</p>
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
