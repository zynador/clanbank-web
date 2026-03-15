'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import ProtectedRoute from '@/components/ProtectedRoute'
import ScreenshotUpload from '@/components/ScreenshotUpload'
import ScreenshotThumb from '@/components/ScreenshotThumb'
import OcrReader from '@/components/OcrReader'
import InfoTooltip from '@/components/InfoTooltip'

type DepositStatus = 'pending' | 'approved' | 'rejected'
type Lang = 'de' | 'en'

type DepositRow = {
  id: string
  user_id: string
  resource_type: string
  amount: number
  note: string | null
  screenshot_url: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
  status: DepositStatus
  rejection_reason: string | null
  profiles: { display_name: string | null; ingame_name: string | null } | null
}

type DepositGroup = {
  key: string
  screenshot_url: string | null
  deposits: DepositRow[]
  player: string
  user_id: string
  date: string
  status: DepositStatus
}

function StatusBadge({ status, lang }: { status: DepositStatus; lang: Lang }) {
  const tips = {
    approved: {
      de: 'Diese Einzahlung wurde geprüft und zählt in der Rangliste.',
      en: 'This deposit has been reviewed and counts in the rankings.',
    },
    pending: {
      de: 'Manuelle Eingabe — ein Offizier prüft diese Einzahlung. Noch nicht in der Rangliste.',
      en: 'Manual entry — an Officer is reviewing this deposit. Not yet in rankings.',
    },
    rejected: {
      de: 'Abgelehnt — bitte Grund lesen und korrigiert erneut einreichen.',
      en: 'Rejected — please read the reason and resubmit with corrections.',
    },
  }
  const badge =
    status === 'approved' ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
        ✓ {lang === 'de' ? 'Genehmigt' : 'Approved'}
      </span>
    ) : status === 'pending' ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
        ⏳ {lang === 'de' ? 'Ausstehend' : 'Pending'}
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">
        ✗ {lang === 'de' ? 'Abgelehnt' : 'Rejected'}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5">
      {badge}
      <InfoTooltip de={tips[status].de} en={tips[status].en} lang={lang} position="bottom" />
    </span>
  )
}

const RESOURCE_ORDER = ['Cash', 'Arms', 'Cargo', 'Metal', 'Diamond']

function groupDeposits(deposits: DepositRow[]): DepositGroup[] {
  const map = new Map<string, DepositRow[]>()
  for (const d of deposits) {
    const key = d.screenshot_url || d.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(d)
  }
  return Array.from(map.entries()).map(([key, deps]) => {
    const first = deps[0]
    const player = first.profiles?.ingame_name || first.profiles?.display_name || 'Unbekannt'
    const statusPriority: DepositStatus[] = ['rejected', 'pending', 'approved']
    const status = statusPriority.find((s) => deps.some((d) => d.status === s)) ?? 'approved'
    return { key, screenshot_url: first.screenshot_url, deposits: deps, player, user_id: first.user_id, date: first.created_at, status }
  })
}

export default function DepositsPage() {
  return <ProtectedRoute><DepositsContent /></ProtectedRoute>
}

function DepositsContent() {
  const { profile } = useAuth()
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('de')
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formAmounts, setFormAmounts] = useState<Record<string, string>>({
    Cash: '', Arms: '', Cargo: '', Metal: '', Diamond: '',
  })
  const [note, setNote] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotHash, setScreenshotHash] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isManualMode, setIsManualMode] = useState(true)
  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'

  // Sprache aus localStorage laden
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  function handleOcrResult(amounts: Record<string, string>) {
    setFormAmounts((prev) => ({
      Cash: amounts.Cash || prev.Cash,
      Arms: amounts.Arms || prev.Arms,
      Cargo: amounts.Cargo || prev.Cargo,
      Metal: amounts.Metal || prev.Metal,
      Diamond: amounts.Diamond || prev.Diamond,
    }))
    setIsManualMode(false)
  }

  function handleOcrManual() {
    setFormAmounts({ Cash: '', Arms: '', Cargo: '', Metal: '', Diamond: '' })
    setIsManualMode(true)
  }

  const fetchDeposits = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const query = supabase
      .from('deposits')
      .select('*, profiles!deposits_user_id_fkey(display_name, ingame_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (!isOfficerOrAdmin) query.eq('user_id', profile.id)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setDeposits((data as DepositRow[]) || [])
    setLoading(false)
  }, [profile, isOfficerOrAdmin])

  useEffect(() => { fetchDeposits() }, [fetchDeposits])

  async function handleSubmit() {
    if (!profile) return
    const hasAmount = RESOURCE_ORDER.some((r) => parseFloat(formAmounts[r]) > 0)
    if (!hasAmount) { setError(lang === 'de' ? 'Mindestens eine Ressource muss > 0 sein.' : 'At least one resource must be > 0.'); return }
    if (!screenshotUrl) { setError(lang === 'de' ? 'Bitte lade einen Screenshot hoch (Pflichtfeld).' : 'Please upload a screenshot (required).'); return }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.rpc('create_bulk_deposit', {
      input_cash: parseFloat(formAmounts.Cash) || 0,
      input_arms: parseFloat(formAmounts.Arms) || 0,
      input_cargo: parseFloat(formAmounts.Cargo) || 0,
      input_metal: parseFloat(formAmounts.Metal) || 0,
      input_diamond: parseFloat(formAmounts.Diamond) || 0,
      input_note: note || null,
      input_screenshot_url: screenshotUrl,
      input_manual: isManualMode,
      input_screenshot_hash: screenshotHash,
    })
    if (err) {
      setError(err.message)
    } else {
      setSuccess(lang === 'de' ? 'Einzahlung gespeichert!' : 'Deposit saved!')
      setFormAmounts({ Cash: '', Arms: '', Cargo: '', Metal: '', Diamond: '' })
      setNote('')
      setScreenshotUrl(null)
      setScreenshotHash(null)
      setIsManualMode(false)
      fetchDeposits()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const { error: err } = await supabase.rpc('soft_delete_deposit', { input_deposit_id: id })
    if (err) setError(err.message)
    else fetchDeposits()
  }

  async function handleDeleteGroup(group: DepositGroup) {
    const msg = lang === 'de'
      ? `${group.deposits.length} Einzahlung(en) löschen?`
      : `Delete ${group.deposits.length} deposit(s)?`
    if (!confirm(msg)) return
    for (const d of group.deposits) await handleDelete(d.id)
  }

  async function handleResubmitGroup(group: DepositGroup) {
    for (const d of group.deposits) {
      await supabase.rpc('resubmit_deposit', { input_deposit_id: d.id })
    }
    setSuccess(lang === 'de' ? 'Erneut eingereicht – wartet auf Genehmigung.' : 'Resubmitted — waiting for approval.')
    fetchDeposits()
  }

  const formatAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(n)
  }
  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const groups = groupDeposits(deposits)

  const t = {
    back:        { de: '← Dashboard', en: '← Dashboard' },
    newDeposit:  { de: 'Neue Einzahlung', en: 'New Deposit' },
    tip_form: {
      de: 'Ablauf: Screenshot von der Transaktion an "Bam bamm" hochladen → KI liest Werte aus → prüfen → speichern.',
      en: 'Process: Upload screenshot of the transaction to "Bam bamm" → AI reads values → verify → save.',
    },
    notiz:       { de: 'Notiz (optional)', en: 'Note (optional)' },
    screenshot:  { de: 'Screenshot', en: 'Screenshot' },
    tip_screenshot: {
      de: 'Mach im Spiel sofort nach der Überweisung an "Bam bamm" einen Screenshot. Pflichtfeld – ohne Screenshot keine Einzahlung.',
      en: 'Take a screenshot in-game right after sending to "Bam bamm". Required — no deposit without screenshot.',
    },
    tip_ocr: {
      de: 'Die KI liest Ressource und Menge automatisch aus dem Screenshot aus. Bitte Werte prüfen bevor du "Werte übernehmen" klickst.',
      en: 'The AI automatically reads resource type and amount from the screenshot. Please verify values before clicking "Apply Values".',
    },
    tip_manual: {
      de: 'Nur nutzen wenn die KI-Erkennung fehlschlägt. Manuelle Eingaben werden von einem Offizier geprüft und zählen erst nach Genehmigung.',
      en: 'Only use if AI recognition fails. Manual entries are reviewed by an Officer and only count after approval.',
    },
    save:        { de: 'Einzahlung speichern', en: 'Save Deposit' },
    saving:      { de: 'Speichern...', en: 'Saving...' },
    list:        { de: 'Einzahlungen', en: 'Deposits' },
    tip_list: {
      de: 'Alle deine Einzahlungen. Nur genehmigte (✓) zählen in der Rangliste. Ausstehende (⏳) warten auf Offizier-Prüfung.',
      en: 'All your deposits. Only approved (✓) count in rankings. Pending (⏳) are waiting for Officer review.',
    },
    loading:     { de: 'Lade...', en: 'Loading...' },
    empty:       { de: 'Keine Einzahlungen gefunden.', en: 'No deposits found.' },
    resubmit:    { de: '↺ Erneut einreichen', en: '↺ Resubmit' },
    delete:      { de: 'Löschen', en: 'Delete' },
    rejected:    { de: 'Abgelehnt', en: 'Rejected' },
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-teal-400 hover:text-teal-300 text-sm"
          >
            {t.back[lang]}
          </button>
          <span className="text-sm text-gray-400">
            {profile?.ingame_name || profile?.username}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
            {error}
            <button className="ml-2 text-red-400 hover:text-red-200" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-3 text-sm">
            {success}
            <button className="ml-2 text-green-400 hover:text-green-200" onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {/* Formular */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4 flex items-center">
            {t.newDeposit[lang]}
            <InfoTooltip de={t.tip_form.de} en={t.tip_form.en} lang={lang} position="bottom" />
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {RESOURCE_ORDER.map((r) => (
              <div key={r}>
                <label className="block text-xs text-gray-500 mb-1">{r}</label>
                <input
                  type="number"
                  min="0"
                  value={formAmounts[r]}
                  onChange={(e) => setFormAmounts((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">{t.notiz[lang]}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={lang === 'de' ? 'Optionale Notiz' : 'Optional note'}
              className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              {t.screenshot[lang]}
              <span className="text-red-400">*</span>
              <InfoTooltip de={t.tip_screenshot.de} en={t.tip_screenshot.en} lang={lang} position="bottom" />
            </label>
            {profile?.clan_id && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                existingUrl={screenshotUrl}
                isOfficerOrAdmin={isOfficerOrAdmin}
                onUploadComplete={(url, hash) => {
                  setScreenshotUrl(url)
                  if (hash) setScreenshotHash(hash)
                }}
              />
            )}
            <div className="mt-2">
              <span className="text-xs text-gray-600 flex items-center gap-1">
                {lang === 'de' ? 'KI-Erkennung' : 'AI Recognition'}
                <InfoTooltip de={t.tip_ocr.de} en={t.tip_ocr.en} lang={lang} position="bottom" />
              </span>
              <OcrReader imageUrl={screenshotUrl} onResult={handleOcrResult} onManual={handleOcrManual} lang={lang} />
            </div>
            {isManualMode && screenshotUrl && (
              <p className="text-xs text-yellow-500/80 mt-2 flex items-center gap-1">
                ⚠️ {lang === 'de' ? 'Manuelle Eingabe' : 'Manual entry'}
                <InfoTooltip de={t.tip_manual.de} en={t.tip_manual.en} lang={lang} position="bottom" />
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {submitting ? t.saving[lang] : t.save[lang]}
          </button>
        </section>

        {/* Liste */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4 flex items-center">
            {t.list[lang]}
            <InfoTooltip de={t.tip_list.de} en={t.tip_list.en} lang={lang} position="bottom" />
          </h2>

          {loading ? (
            <p className="text-gray-500 text-sm">{t.loading[lang]}</p>
          ) : groups.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.empty[lang]}</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key} className="border border-gray-700 rounded-lg p-4 bg-[#0f1117]">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      <ScreenshotThumb path={group.screenshot_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <StatusBadge status={group.status} lang={lang} />
                        <span className="text-xs text-gray-600 shrink-0">{formatDate(group.date)}</span>
                      </div>
                      {isOfficerOrAdmin && (
                        <p className="text-xs text-gray-500 mb-2">{group.player}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {group.deposits.map((dep) => (
                          <span key={dep.id} className="text-sm font-medium text-teal-400">
                            {dep.resource_type} {formatAmount(dep.amount)}
                          </span>
                        ))}
                      </div>
                      {group.deposits[0].note && (
                        <p className="text-xs text-gray-500 mb-2">{group.deposits[0].note}</p>
                      )}
                      {group.status === 'rejected' && group.deposits[0].rejection_reason && (
                        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 mb-2">
                          {t.rejected[lang]}: {group.deposits[0].rejection_reason}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap mt-2">
                        {group.status === 'rejected' && group.user_id === profile?.id && (
                          <button
                            onClick={() => handleResubmitGroup(group)}
                            className="text-xs text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-2 py-1"
                          >
                            {t.resubmit[lang]}
                          </button>
                        )}
                        {(group.user_id === profile?.id || isOfficerOrAdmin) && (
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded px-2 py-1"
                          >
                            {t.delete[lang]}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
