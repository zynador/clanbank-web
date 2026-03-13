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
    for (const dep of group.deposits) {
      await supabase.rpc('approve_deposit', { input_deposit_id: dep.id })
    }
    setActionKey(null)
    loadPending()
  }

  const handleRejectGroup = async (group: DepositGroup) => {
    setActionKey(group.key)
    for (const dep of group.deposits) {
      await supabase.rpc('reject_deposit', {
        input_deposit_id: dep.id,
        input_reason: rejectReason.trim() || null,
      })
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
      <p className="text-gray-400 te
