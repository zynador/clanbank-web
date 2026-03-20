'use client'

import { useState, useEffect, useRef } from 'react'
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

const MAX_SCREEN_AGE_DAYS = 7

function getKwFromDate(val: string): { kw: number; year: number } {
  const date = new Date(val)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const kw = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { kw, year: d.getUTCFullYear() }
}

function isFileTooOld(file: File): boolean {
  const ageMs = Date.now() - file.lastModified
  return ageMs > MAX_SCREEN_AGE_DAYS * 24 * 60 * 60 * 1000
}

function makeEmptySlots(): ScreenSlot[] {
  return Array.from({ length: 6 }, () => ({ url: null, hash: null }))
}

export default function BattleReportUpload({ lang, onComplete }: Props) {
  const { profile } = useAuth()

  const [isRaidleiter, setIsRaidleiter] = useState(false)
  const [step, setStep] = useState<'overview' | 'details' | 'done'>('overview')
  const [battleReportId, setBattleReportId] = useState<string | null>(null)

  const [overviewUrl, setOverviewUrl] = useState<string | null>(null)
  const [overviewHash, setOverviewHash] = useState<string | null>(null)
  const [battleDateStr, setBattleDateStr] = useState('')
  const [battleKw, setBattleKw] = useState<number>(1)
  const [battleYear, setBattleYear] = useState<number>(new Date().getFullYear())
  const [side, setSide] = useState<Side>('attacker')

  const [slots, setSlots] = useState<ScreenSlot[]>(makeEmptySlots())
  const [uploadedCount, setUploadedCount] = useState(0)
  const [ocrStatus, setOcrStatus] = useState<string | null>(null)

  const [multiUploading, setMultiUploading] = useState(false)
  const multiFileRef = useRef<HTMLInputElement>(null)

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
      const timer = setTimeout(() => setFeedback(null), 6000)
      return () => clearTimeout(timer)
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

  function updateSlot(index: number, url: string, hash: string | undefined | null) {
    setSlots(prev => {
      const next = [...prev]
      next[index] = { url, hash: hash ?? null }
      return next
    })
  }

  async function handleCreateReport() {
    if (!profile?.clan_id) {
      setFeedback({ type: 'error', text: lang === 'de' ? 'Clan-ID fehlt.' : 'Clan ID missing.' })
      return
    }
    if (!overviewUrl) {
      setFeedback({
        type: 'error',
        text: lang === 'de'
          ? 'Bitte zuerst den Übersichts-Screen hochladen.'
          : 'Please upload the overview screenshot first.',
      })
      return
    }
    if (!battleDateStr) {
      setFeedback({
        type: 'error',
        text: lang === 'de'
          ? 'Kampfdatum ist Pflichtfeld. Bitte das Datum vom Screenshot eintragen.'
          : 'Battle date is required. Please enter the date shown on the screenshot.',
      })
      return
    }

    setSaving(true)
    setFeedback(null)

    if (overviewHash) {
      const { data: dup } = await supabase.rpc('check_battle_screenshot_hash', { p_hash: overviewHash })
      if (dup?.exists) {
        setFeedback({
          type: 'error',
          text: lang === 'de'
            ? 'Dieser Screenshot wurde bereits hochgeladen.'
            : 'This screenshot has already been uploaded.',
        })
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
        ? 'Kampfbericht angelegt (KW ' + battleKw + '/' + battleYear + '). Jetzt Detail-Screens hochladen.'
        : 'Battle report created (W' + battleKw + '/' + battleYear + '). Now upload detail screens.',
    })
    setSaving(false)
  }

  async function handleFinish() {
    if (!battleReportId) return
    const filled = slots.filter(s => s.url !== null)
    if (filled.length === 0) {
      setFeedback({
        type: 'error',
        text: lang === 'de'
          ? 'Mindestens ein Detail-Screen erforderlich.'
          : 'At least one detail screen is required.',
      })
      return
    }
    setSaving(true)
    setFeedback(null)
    setOcrStatus(lang === 'de' ? 'Screens werden verarbeitet...' : 'Processing screens...')

    let successCount = 0
    let ocrCount = 0

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
      if (!error && data?.success) {
        successCount++
        try {
          const { data: urlData } = await supabase.storage.from('screenshots').createSignedUrl(slot.url, 300)
          const publicUrl = urlData?.signedUrl
          if (publicUrl) {
            setOcrStatus(
              lang === 'de'
                ? 'OCR Screen ' + successCount + ' von ' + filled.length + '...'
                : 'OCR screen ' + successCount + ' of ' + filled.length + '...'
            )
            const ocrRes = await fetch('/api/ocr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: publicUrl, mode: 'battle_detail' }),
            })
            const ocrJson = await ocrRes.json()
            if (ocrJson?.casualties && ocrJson.casualties.length > 0) {
              const { error: saveErr } = await supabase.rpc('save_battle_casualties', {
                p_battle_report_id: battleReportId,
                p_casualties: ocrJson.casualties,
              })
              if (!saveErr) ocrCount += ocrJson.casualties.length
            }
          }
        } catch (ocrErr) {
          console.error('OCR error for slot:', slot.url, ocrErr)
        }
      }
    }

    setUploadedCount(successCount)
    setOcrStatus(null)
    setSaving(false)

    if (successCount === 0) {
      setFeedback({
        type: 'error',
        text: lang === 'de'
          ? 'Keine Screens konnten hochgeladen werden.'
          : 'No screens could be uploaded.',
      })
      return
    }

    setFeedback({
      type: 'success',
      text: lang === 'de'
        ? successCount + ' Screen(s) gespeichert, ' + ocrCount + ' Verlust-Einträge erkannt.'
        : successCount + ' screen(s) saved, ' + ocrCount + ' casualty entries detected.',
    })

    setStep('done')
    if (onComplete && battleReportId) onComplete(battleReportId)
  }

  async function handleMultiFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !profile?.clan_id) return

    const tooOld = files.filter(f => isFileTooOld(f))
    if (tooOld.length > 0) {
      setFeedback({
        type: 'error',
        text: lang === 'de'
          ? tooOld.length + ' Datei(en) sind älter als ' + MAX_SCREEN_AGE_DAYS + ' Tage und wurden nicht hochgeladen. Bitte aktuelle Screenshots verwenden.'
          : tooOld.length + ' file(s) are older than ' + MAX_SCREEN_AGE_DAYS + ' days and were not uploaded. Please use recent screenshots.',
      })
      if (multiFileRef.current) multiFileRef.current.value = ''
      if (tooOld.length === files.length) return
    }

    const validFiles = files.filter(f => !isFileTooOld(f)).slice(0, 6)
    if (validFiles.length === 0) return

    setMultiUploading(true)

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        const buf = await file.arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', buf)
        const hash = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
        const ext = file.name.split('.').pop() || 'jpg'
        const path = profile.clan_id + '/' + Date.now() + '_' + i + '_detail.' + ext
        const { error: upErr } = await supabase.storage
          .from('screenshots')
          .upload(path, file, { upsert: false })
        if (upErr) {
          console.error('Multi-upload slot ' + i, upErr)
          continue
        }
        updateSlot(i, path, hash)
      } catch (err) {
        console.error('Multi-upload error slot ' + i, err)
      }
    }

    setMultiUploading(false)
    if (multiFileRef.current) multiFileRef.current.value = ''
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
    setSlots(makeEmptySlots())
    setUploadedCount(0)
    setOcrStatus(null)
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

      {ocrStatus && (
        <div className="px-4 py-3 rounded-lg text-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2">
          <span className="animate-pulse">⏳</span>
          <span>{ocrStatus}</span>
        </div>
      )}

      {/* Schritt-Anzeige */}
      <div className="flex items-center gap-2 text-xs">
        <span className={step === 'overview' ? 'text-blue-400 font-medium' : 'text-zinc-500 line-through'}>
          {'1. ' + (lang === 'de' ? 'Übersicht' : 'Overview')}
        </span>
        <span className="text-zinc-700">{'→'}</span>
        <span className={step === 'details' ? 'text-blue-400 font-medium' : step === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-600'}>
          {'2. ' + (lang === 'de' ? 'Details' : 'Details')}
        </span>
        <span className="text-zinc-700">{'→'}</span>
        <span className={step === 'done' ? 'text-green-400 font-medium' : 'text-zinc-600'}>
          {'3. ' + (lang === 'de' ? 'Fertig' : 'Done')}
        </span>
      </div>

      {/* SCHRITT 1: ÜBERSICHT */}
      {step === 'overview' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">

          {/* Erklärungsbox */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-1.5 text-xs text-zinc-400">
            <p className="font-medium text-zinc-300">
              {'ℹ️ ' + (lang === 'de' ? 'So funktioniert der Kampfbericht-Upload' : 'How battle report upload works')}
            </p>
            <p>{lang === 'de' ? '1. Übersichts-Screen hochladen (zeigt Datum, Uhrzeit und [1Ca]-Kürzel)' : '1. Upload overview screen (shows date, time and [1Ca] tag)'}</p>
            <p>{lang === 'de' ? '2. Kampfdatum manuell eintragen — exakt wie auf dem Screenshot sichtbar' : '2. Enter battle date manually — exactly as shown on the screenshot'}</p>
            <p>{lang === 'de' ? '3. Detail-Screens hochladen (ein Screen pro Spieler-Block, bis zu 6 auf einmal)' : '3. Upload detail screens (one screen per player block, up to 6 at once)'}</p>
            <p>{lang === 'de' ? '4. OCR liest automatisch: Spielername, Truppenart, Tier, Verwundete (T4+)' : '4. OCR reads automatically: player name, troop type, tier, wounded (T4+)'}</p>
            <p className="text-amber-400/80">
              {'⏱ ' + (lang === 'de'
                ? 'Screenshots dürfen maximal ' + MAX_SCREEN_AGE_DAYS + ' Tage alt sein (Dateidatum).'
                : 'Screenshots must not be older than ' + MAX_SCREEN_AGE_DAYS + ' days (file date).')}
            </p>
          </div>

          {/* h3 mit InfoTooltip — korrekt, kein label-Konflikt */}
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
            {'📋 ' + (lang === 'de' ? 'Schritt 1: Übersichts-Screen' : 'Step 1: Overview Screen')}
            <InfoTooltip
              de="Der Übersichts-Screen zeigt oben rechts Datum und Uhrzeit des Kampfes sowie das [1Ca]-Kürzel. Er wird zuerst hochgeladen und legt die Kalenderwoche fest."
              en="The overview screen shows the battle date and time (top right) and the [1Ca] tag. It is uploaded first and determines the calendar week."
              lang={lang}
              position="bottom"
            />
          </h3>

          {/* Übersichts-Screenshot */}
          <div>
            <p className="text-xs text-zinc-500 mb-1">
              {lang === 'de' ? 'Übersichts-Screen' : 'Overview screenshot'}
              <span className="text-red-400 ml-1">{'*'}</span>
            </p>
            {profile?.clan_id && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                existingUrl={overviewUrl}
                isOfficerOrAdmin={true}
                maxAgeDays={7}
                onUploadComplete={(url, hash) => {
                  setOverviewUrl(url)
                  setOverviewHash(hash ?? null)
                }}
              />
            )}
            {overviewUrl && (
              <p className="text-xs text-green-400/70 mt-1">
                {'✓ ' + (lang === 'de' ? 'Screenshot hochgeladen' : 'Screenshot uploaded')}
              </p>
            )}
          </div>

          {/* Kampfdatum — InfoTooltip im div neben label, NICHT im label */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label htmlFor="battle-date" className="text-xs text-zinc-500">
                {lang === 'de' ? 'Kampfdatum' : 'Battle date'}
              </label>
              <span className="text-red-400 text-xs">{'*'}</span>
              <InfoTooltip
                de="Das Datum des Kampfes — sichtbar oben rechts auf dem Übersichts-Screen. Pflichtfeld für die Kalenderwochenberechnung und Auszahlungsberechtigung."
                en="The battle date — visible top right on the overview screen. Required for calendar week calculation and payout eligibility."
                lang={lang}
                position="bottom"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                id="battle-date"
                type="date"
                value={battleDateStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className={'bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 ' + (
                  !battleDateStr ? 'border-amber-600/60' : 'border-zinc-700'
                )}
              />
              {battleDateStr ? (
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                  {'📅 KW ' + battleKw + ' / ' + battleYear}
                </span>
              ) : (
                <span className="text-xs text-amber-500/80">
                  {lang === 'de' ? '⚠ Datum vom Screenshot eintragen' : '⚠ Enter date from screenshot'}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              {lang === 'de'
                ? 'Das Datum bestimmt die Kalenderwoche — maßgeblich für die Einzahlungsschwelle.'
                : 'The date determines the calendar week — relevant for the deposit threshold check.'}
            </p>
          </div>

          {/* KW-Korrektur und Seite — InfoTooltip im div neben label, NICHT im label */}
          <div className="flex gap-6 flex-wrap items-end">
            <div>
              <label htmlFor="battle-kw" className="text-xs text-zinc-500 block mb-1">
                {lang === 'de' ? 'KW (Korrektur)' : 'Week (override)'}
              </label>
              <select
                id="battle-kw"
                value={battleKw}
                onChange={(e) => setBattleKw(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                {kwOptions.map(kw => (
                  <option key={kw} value={kw}>{'KW ' + kw}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label htmlFor="battle-side" className="text-xs text-zinc-500">
                  {lang === 'de' ? 'Seite' : 'Side'}
                </label>
                <span className="text-red-400 text-xs">{'*'}</span>
                <InfoTooltip
                  de="Angreifer = [1Ca] hat den Raid gestartet. Verteidiger = [1Ca] wurde angegriffen. Bestimmt welche Spieler-Spalte die OCR auswertet."
                  en="Attacker = [1Ca] started the raid. Defender = [1Ca] was attacked. Determines which player column OCR evaluates."
                  lang={lang}
                  position="bottom"
                />
              </div>
              <select
                id="battle-side"
                value={side}
                onChange={(e) => setSide(e.target.value as Side)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                <option value="attacker">{lang === 'de' ? 'Angreifer [1Ca]' : 'Attacker [1Ca]'}</option>
                <option value="defender">{lang === 'de' ? 'Verteidiger [1Ca]' : 'Defender [1Ca]'}</option>
              </select>
            </div>
          </div>

          {/* Validierungsstatus */}
          {(!overviewUrl || !battleDateStr) && (
            <div className="text-xs space-y-0.5">
              {!overviewUrl && (
                <p className="text-amber-500/70">{'• ' + (lang === 'de' ? 'Übersichts-Screen fehlt' : 'Overview screenshot missing')}</p>
              )}
              {!battleDateStr && (
                <p className="text-amber-500/70">{'• ' + (lang === 'de' ? 'Kampfdatum fehlt' : 'Battle date missing')}</p>
              )}
            </div>
          )}

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

      {/* SCHRITT 2: DETAIL-SCREENS */}
      {step === 'details' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">

          {/* Zusammenfassung Schritt 1 */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-lg px-3 py-2 text-xs text-zinc-400 flex gap-4 flex-wrap">
            <span>{'📅 ' + (lang === 'de' ? 'Datum:' : 'Date:') + ' ' + battleDateStr}</span>
            <span>{'📊 KW ' + battleKw + ' / ' + battleYear}</span>
            <span>{'⚔️ ' + (side === 'attacker'
              ? (lang === 'de' ? 'Angreifer' : 'Attacker')
              : (lang === 'de' ? 'Verteidiger' : 'Defender'))}</span>
          </div>

          {/* Erklärungsbox Detail */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-1.5 text-xs text-zinc-400">
            <p className="font-medium text-zinc-300">
              {'ℹ️ ' + (lang === 'de' ? 'Was sind Detail-Screens?' : 'What are detail screens?')}
            </p>
            <p>
              {lang === 'de'
                ? 'Jeder Detail-Screen zeigt einen Spieler-Block mit Truppenverlusten. Die OCR liest daraus: Spielername, Truppenart (Messer/Schützen/Biker/Autos), Tier und Verwundete.'
                : 'Each detail screen shows a player block with troop losses. OCR reads: player name, troop type (Knife/Shooter/Biker/Car), tier and wounded count.'}
            </p>
            <p>
              {lang === 'de'
                ? 'Nur T4+ Verwundete werden für die Auszahlungsberechnung gewertet. Tote werden ignoriert.'
                : 'Only T4+ wounded count for payout calculation. Dead troops are ignored.'}
            </p>
            <p className="text-amber-400/80">
              {'⏱ ' + (lang === 'de'
                ? 'Screens müssen innerhalb der letzten ' + MAX_SCREEN_AGE_DAYS + ' Tage aufgenommen worden sein.'
                : 'Screens must have been taken within the last ' + MAX_SCREEN_AGE_DAYS + ' days.')}
            </p>
          </div>

          {/* h3 mit InfoTooltip — korrekt */}
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
            {'🖼️ ' + (lang === 'de' ? 'Schritt 2: Detail-Screens' : 'Step 2: Detail Screens')}
            <InfoTooltip
              de="Lade bis zu 6 Kampf-Detail-Screens hoch. Jeder Screen zeigt einen Spieler-Block. Die OCR erkennt automatisch Truppenart, Tier und Verwundete (rot markierte Zahlen in der Verwundete-Spalte)."
              en="Upload up to 6 battle detail screens. Each screen shows a player block. OCR automatically detects troop type, tier and wounded (red numbers in the wounded column)."
              lang={lang}
              position="bottom"
            />
            {filledSlots > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                {filledSlots + '/6 ' + (lang === 'de' ? 'bereit' : 'ready')}
              </span>
            )}
          </h3>

          {/* Multi-Upload */}
          <div>
            <input
              ref={multiFileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleMultiFileSelect}
            />
            <button
              onClick={() => multiFileRef.current?.click()}
              disabled={multiUploading}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {multiUploading
                ? (lang === 'de' ? '⏳ Wird hochgeladen...' : '⏳ Uploading...')
                : ('📁 ' + (lang === 'de'
                    ? 'Alle Screens auf einmal hochladen (bis zu 6)'
                    : 'Upload all screens at once (up to 6)'))}
            </button>
            <p className="text-xs text-zinc-600 text-center mt-1">
              {lang === 'de' ? 'Oder einzelne Slots unten manuell befüllen' : 'Or fill individual slots manually below'}
            </p>
          </div>

          {/* Slot-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {slots.map((slot, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-zinc-600">
                  {'Screen ' + (i + 1)}
                  {slot.url && <span className="ml-1 text-green-400">{'✓'}</span>}
                </p>
                {profile?.clan_id && (
                  <ScreenshotUpload
                    key={'slot-' + i + '-' + (slot.url ? '1' : '0')}
                    clanId={profile.clan_id}
                    existingUrl={slot.url ?? undefined}
                    isOfficerOrAdmin={true}
                    maxAgeDays={7}
                    onUploadComplete={(url, hash) => { if (url) updateSlot(i, url, hash ?? null) }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <p className="text-xs text-zinc-500">
              {lang === 'de'
                ? 'Alle Screens hochgeladen? Nach dem Abschließen startet die OCR-Analyse automatisch.'
                : 'All screens uploaded? After finishing, OCR analysis starts automatically.'}
            </p>
            <button
              onClick={handleFinish}
              disabled={saving || filledSlots === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {saving
                ? (lang === 'de' ? '⏳ Wird verarbeitet...' : '⏳ Processing...')
                : ('✓ ' + (lang === 'de'
                    ? 'Upload abschließen & OCR starten (' + filledSlots + ' Screen(s))'
                    : 'Finish upload & start OCR (' + filledSlots + ' screen(s))'))
              }
            </button>
          </div>
        </div>
      )}

      {/* SCHRITT 3: FERTIG */}
      {step === 'done' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-center space-y-3">
          <div className="text-3xl">{'✅'}</div>
          <p className="text-sm font-medium text-green-400">
            {lang === 'de' ? 'Upload abgeschlossen!' : 'Upload complete!'}
          </p>
          <div className="text-xs text-zinc-500 space-y-1">
            <p>
              {lang === 'de'
                ? uploadedCount + ' Detail-Screen(s) gespeichert.'
                : uploadedCount + ' detail screen(s) saved.'}
            </p>
            <p>
              {lang === 'de'
                ? 'OCR-Analyse abgeschlossen — Verluste wurden automatisch erkannt.'
                : 'OCR analysis complete — casualties have been detected automatically.'}
            </p>
            <p className="text-zinc-600">
              {lang === 'de'
                ? 'Die Auszahlungsberechnung kann jetzt im Tab „Auszahlungen" gestartet werden.'
                : 'Payout calculation can now be started in the "Payouts" tab.'}
            </p>
          </div>
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
