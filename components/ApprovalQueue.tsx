'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getScreenshotUrl, isScreenshotPdf } from '@/lib/screenshotHelpers'
import ScreenshotLightbox from '@/components/ScreenshotLightbox'
import InfoTooltip from '@/components/InfoTooltip'

type Lang = 'de' | 'en'
type ResourceType = 'Cash' | 'Arms' | 'Cargo' | 'Metal' | 'Diamond'

const RESOURCE_CONFIG: Record<ResourceType, { color: string; icon: string }> = {
  Cash:    { color: '#22c55e', icon: '/cash.png' },
  Arms:    { color: '#ef4444', icon: '/arms.png' },
  Cargo:   { color: '#3b82f6', icon: '/cargo.png' },
  Metal:   { color: '#a855f7', icon: '/metal.png' },
  Diamond: { color: '#06b6d4', icon: '/diamond.png' },
}

interface PendingDeposit {
  id: string
  user_id: string
  resource_type: ResourceType
  amount: number
  note: string | null
  screenshot_url: string | null
  created_at: string
  profiles: { username: string; ingame_name: string | null; display_name: string | null }
}

interface DepositGroup {
  key: string
  screenshot_url: string | null
  deposits: PendingDeposit[]
  player: string
  date: string
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString('de-DE')
}

function groupDeposits(deposits: PendingDeposit[]): DepositGroup[] {
  const map = new Map<string, PendingDeposit[]>()
  for (const d of deposits) {
    const key = d.screenshot_url || d.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(d)
  }
  return Array.from(map.entries()).map(([key, deps]) => {
    const first = deps[0]
    const player = first.profiles?.ingame_name || first.profiles?.display_name || first.profiles?.username || '?'
    return { key, screenshot_url: first.screenshot_url, deposits: deps, player, date: first.created_at }
  })
}

export default function ApprovalQueue() {
  const [lang, setLang] = useState<Lang>('de')
  const [pending, setPending] = useState<PendingDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxIsPdf, setLightboxIsPdf] = useState(false)
  const [rejectingKey, setRejectingKey] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({})

  // Sprache aus localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clanbank_lang')
      if (saved === 'en' || saved === 'de') setLang(saved)
    } catch {}
  }, [])

  const loadPending = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deposits')
      .select('*, profiles!deposits_user_id_fkey(username, ingame_name, display_name)')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (!error && data) setPending(data as unknown as PendingDeposit[])
    setLoading(false)
  }, [])

  useEffect(() => { loadPending() }, [loadPending])

  const openScreenshot = async (url: string) => {
    const signed = await getScreenshotUrl(url)
    if (signed) {
      setLightboxIsPdf(isScreenshotPdf(url))
      setLightboxUrl(signed)
    }
  }

  const handleApproveGroup = async (group: DepositGroup) => {
    setActionKey(group.key)
    setGroupErrors(prev => { const n = {...prev}; delete n[group.key]; return n })
    for (const dep of group.deposits) {
      const { data } = await supabase.rpc('approve_deposit', { input_deposit_id: dep.id })
      if (data && data.success === false) {
        setGroupErrors(prev => ({ ...prev, [group.key]: data.message }))
        setActionKey(null)
        return
      }
    }
    setActionKey(null)
    loadPending()
  }

  const handleRejectGroup = async (group: DepositGroup) => {
    setActionKey(group.key)
    setGroupErrors(prev => { const n = {...prev}; delete n[group.key]; return n })
    for (const dep of group.deposits) {
      const { data } = await supabase.rpc('reject_deposit', {
        input_deposit_id: dep.id,
        input_reason: rejectReason.trim() || null,
      })
      if (data && data.success === false) {
        setGroupErrors(prev => ({ ...prev, [group.key]: data.message }))
        setActionKey(null)
        return
      }
    }
    setActionKey(null)
    setRejectingKey(null)
    setRejectReason('')
    loadPending()
  }

  const t = {
    loading: { de: 'Lade ausstehende Einzahlungen...', en: 'Loading pending deposits...' },
    empty:   { de: 'Keine ausstehenden Einzahlungen.', en: 'No pending deposits.' },
    tip_queue: {
      de: 'Hier landen alle manuell eingegebenen Einzahlungen. Prüfe Screenshot gegen die Werte und genehmige oder lehne ab.',
      en: 'All manually entered deposits appear here. Check screenshot against values and approve or reject.',
    },
    pending_count_de: (n: number) => `${n} ausstehende Einzahlung${n !== 1 ? 'en' : ''}`,
    pending_count_en: (n: number) => `${n} pending deposit${n !== 1 ? 's' : ''}`,
    screenshot: { de: '📷 Screenshot ansehen', en: '📷 View Screenshot' },
    tip_screenshot: {
      de: 'Öffne den Screenshot und vergleiche ihn mit den eingegebenen Werten. Stimmen Ressource, Menge und Empfänger "Bam bamm" überein?',
      en: 'Open the screenshot and compare it with the entered values. Do resource, amount and recipient "Bam bamm" match?',
    },
    no_screenshot: { de: '⚠ Kein Screenshot vorhanden', en: '⚠ No screenshot available' },
    approve: (n: number, lang: Lang) => lang === 'de'
      ? `✓ Genehmigen${n > 1 ? ` (${n})` : ''}`
      : `✓ Approve${n > 1 ? ` (${n})` : ''}`,
    tip_approve: {
      de: 'Einzahlung ist korrekt. Nach Genehmigung zählt sie sofort in der Rangliste.',
      en: 'Deposit is correct. After approval it counts immediately in the rankings.',
    },
    reject: { de: '✕ Ablehnen', en: '✕ Reject' },
    tip_reject: {
      de: 'Werte stimmen nicht mit dem Screenshot überein. Der Spieler erhält deinen Ablehnungsgrund und kann korrigieren und erneut einreichen.',
      en: 'Values do not match the screenshot. The player receives your rejection reason and can correct and resubmit.',
    },
    reject_title: { de: 'Ablehnungsgrund (optional)', en: 'Rejection reason (optional)' },
    tip_reason: {
      de: 'Erkläre kurz was nicht stimmt, z.B. "Falscher Betrag" oder "Kein Empfänger Bam bamm sichtbar". Der Spieler sieht diesen Text.',
      en: 'Briefly explain what\'s wrong, e.g. "Wrong amount" or "Recipient Bam bamm not visible". The player will see this text.',
    },
    reject_placeholder: {
      de: 'z.B. Falscher Spielername im Screenshot',
      en: 'e.g. Wrong player name in screenshot',
    },
    reject_confirm: { de: '✕ Ablehnen bestätigen', en: '✕ Confirm Rejection' },
    cancel: { de: 'Abbrechen', en: 'Cancel' },
  }

  if (loading) return <p className="text-gray-500 text-sm">{t.loading[lang]}</p>

  const groups = groupDeposits(pending)

  if (groups.length === 0) return (
    <div className="text-center py-8">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-gray-400 text-sm">{t.empty[lang]}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Zähler + Erklärung */}
      <p className="text-xs text-gray-500 flex items-center">
        {lang === 'de' ? t.pending_count_de(groups.length) : t.pending_count_en(groups.length)}
        <InfoTooltip de={t.tip_queue.de} en={t.tip_queue.en} lang={lang} position="bottom" />
      </p>

      {groups.map((group) => {
        const isActing = actionKey === group.key
        const isRejecting = rejectingKey === group.key

        return (
          <div key={group.key} className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-3">

            {/* Header: Spieler + Datum */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200">{group.player}</span>
              <span className="text-xs text-gray-600">
                {new Date(group.date).toLocaleDateString('de-DE', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            {/* Ressourcen */}
            <div className="flex flex-wrap gap-3">
              {group.deposits.map((dep) => {
                const cfg = RESOURCE_CONFIG[dep.resource_type]
                return (
                  <span key={dep.id} className="inline-flex items-center gap-1.5 text-sm font-mono" style={{ color: cfg.color }}>
                    <img src={cfg.icon} alt="" className="w-4 h-4" />
                    {formatNumber(dep.amount)} {dep.resource_type}
                  </span>
                )
              })}
            </div>

            {/* Notiz */}
            {group.deposits[0].note && (
              <p className="text-xs text-gray-500 italic">„{group.deposits[0].note}"</p>
            )}

            {/* Screenshot */}
            {group.screenshot_url ? (
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={() => openScreenshot(group.screenshot_url!)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  {t.screenshot[lang]}
                </button>
                <InfoTooltip de={t.tip_screenshot.de} en={t.tip_screenshot.en} lang={lang} position="bottom" />
              </span>
            ) : (
              <span className="text-xs text-red-400/70">{t.no_screenshot[lang]}</span>
            )}

            {/* Fehlermeldung */}
            {groupErrors[group.key] && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                ⚠ {groupErrors[group.key]}
              </p>
            )}

            {/* Ablehnen-Formular */}
            {isRejecting && (
              <div className="bg-[#0f1117] border border-red-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-red-400 font-medium flex items-center">
                  {t.reject_title[lang]}
                  <InfoTooltip de={t.tip_reason.de} en={t.tip_reason.en} lang={lang} position="bottom" />
                </p>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t.reject_placeholder[lang]}
                  className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectGroup(group)}
                    disabled={isActing}
                    className="text-xs px-3 py-1.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-40"
                  >
                    {isActing ? '...' : t.reject_confirm[lang]}
                  </button>
                  <button
                    onClick={() => { setRejectingKey(null); setRejectReason('') }}
                    className="text-xs px-3 py-1.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                  >
                    {t.cancel[lang]}
                  </button>
                </div>
              </div>
            )}

            {/* Aktions-Buttons */}
            {!isRejecting && (
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1">
                  <button
                    onClick={() => handleApproveGroup(group)}
                    disabled={isActing}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:opacity-40 transition-colors"
                  >
                    {isActing ? '...' : t.approve(group.deposits.length, lang)}
                  </button>
                  <InfoTooltip de={t.tip_approve.de} en={t.tip_approve.en} lang={lang} position="bottom" />
                </span>
                <span className="inline-flex items-center gap-1">
                  <button
                    onClick={() => setRejectingKey(group.key)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
                  >
                    {t.reject[lang]}
                  </button>
                  <InfoTooltip de={t.tip_reject.de} en={t.tip_reject.en} lang={lang} position="bottom" />
                </span>
              </div>
            )}
          </div>
        )
      })}

      {lightboxUrl && (
        <ScreenshotLightbox url={lightboxUrl} isPdf={lightboxIsPdf} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}
