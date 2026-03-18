'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import InfoTooltip from '@/components/InfoTooltip'

type Lang = 'de' | 'en'

interface BattleReport {
  id: string
  battle_date: string
  battle_kw: number
  battle_year: number
  side: string
  status: string
  created_by_name: string
  recipient_count: number
  eligible_count: number
  created_at: string
}

interface PayoutDetail {
  payout_id: string
  recipient_id: string
  ingame_name: string
  resource: string
  amount: number
  eligible: boolean
  status: string
  approved_by: string | null
  approved_at: string | null
}

interface PayoutByPlayer {
  recipient_id: string
  ingame_name: string
  eligible: boolean
  status: string
  resources: Record<string, number>
}

interface Props {
  lang: Lang
}

const RESOURCE_ORDER = ['cash', 'arms', 'cargo', 'metal', 'diamond']
const RESOURCE_LABELS: Record<string, string> = {
  cash: 'Cash', arms: 'Arms', cargo: 'Cargo', metal: 'Metal', diamond: 'Diamond'
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function groupPayoutsByPlayer(details: PayoutDetail[]): PayoutByPlayer[] {
  const map = new Map<string, PayoutByPlayer>()
  for (const d of details) {
    if (!map.has(d.recipient_id)) {
      map.set(d.recipient_id, {
        recipient_id: d.recipient_id,
        ingame_name: d.ingame_name,
        eligible: d.eligible,
        status: d.status,
        resources: {},
      })
    }
    const player = map.get(d.recipient_id)!
    player.resources[d.resource] = d.amount
    // eligible/status vom höchsten Wert
    if (d.eligible) player.eligible = true
  }
  return Array.from(map.values()).sort((a, b) => a.ingame_name.localeCompare(b.ingame_name))
}

export default function PayoutCalculation({ lang }: Props) {
  const { profile } = useAuth()
  const [reports, setReports] = useState<BattleReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<PayoutDetail[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isRaidleiter, setIsRaidleiter] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const isOfficerOrAdmin = profile?.role === 'admin' || profile?.role === 'offizier'

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profiles').select('is_raidleiter').eq('id', profile.id).single()
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

  const canUse = isOfficerOrAdmin || isRaidleiter

  const fetchReports = useCallback(async () => {
    setLoadingReports(true)
    const { data, error } = await supabase.rpc('get_battle_reports')
    if (error) {
      setFeedback({ type: 'error', text: error.message })
    } else {
      setReports((data as BattleReport[]) || [])
    }
    setLoadingReports(false)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function fetchDetails(reportId: string) {
    setLoadingDetails(true)
    const { data, error } = await supabase.rpc('get_payout_details', {
      p_battle_report_id: reportId,
    })
    if (error) {
      setFeedback({ type: 'error', text: error.message })
    } else {
      setDetails((data as PayoutDetail[]) || [])
    }
    setLoadingDetails(false)
  }

  function handleSelectReport(reportId: string) {
    setSelectedId(reportId)
    setDetails([])
    const report = reports.find(r => r.id === reportId)
    if (report && report.status !== 'draft') {
      fetchDetails(reportId)
    }
  }

  async function handleCalculate() {
    if (!selectedId) return
    setCalculating(true)
    setFeedback(null)
    const { data, error } = await supabase.rpc('calculate_payouts', {
      p_battle_report_id: selectedId,
    })
    if (error || !data?.success) {
      setFeedback({ type: 'error', text: data?.message || error?.message || 'Fehler' })
    } else {
      setFeedback({
        type: 'success',
        text: lang === 'de' ? 'Auszahlungen berechnet.' : 'Payouts calculated.',
      })
      await fetchReports()
      await fetchDetails(selectedId)
    }
    setCalculating(false)
  }

  async function handleApprove() {
    if (!selectedId) return
    const msg = lang === 'de'
      ? 'Alle berechtigten Auszahlungen freigeben und Bericht als ausgezahlt markieren?'
      : 'Approve all eligible payouts and mark report as paid?'
    if (!confirm(msg)) return
    setApproving(true)
    setFeedback(null)
    const { data, error } = await supabase.rpc('approve_battle_report', {
      p_battle_report_id: selectedId,
    })
    if (error || !data?.success) {
      setFeedback({ type: 'error', text: data?.message || error?.message || 'Fehler' })
    } else {
      setFeedback({
        type: 'success',
        text: lang === 'de' ? 'Bericht abgeschlossen. Auszahlungen freigegeben.' : 'Report closed. Payouts approved.',
      })
      await fetchReports()
      await fetchDetails(selectedId)
    }
    setApproving(false)
  }

  const selectedReport = reports.find(r => r.id === selectedId) ?? null
  const players = groupPayoutsByPlayer(details)
  const eligiblePlayers = players.filter(p => p.eligible)
  const ineligiblePlayers = players.filter(p => !p.eligible)

  const statusBadge = (status: string) => {
    if (status === 'draft') return <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/40 text-zinc-400 border border-zinc-600/30">{lang === 'de' ? 'Entwurf' : 'Draft'}</span>
    if (status === 'calculated') return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">{lang === 'de' ? 'Berechnet' : 'Calculated'}</span>
    if (status === 'paid') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">{lang === 'de' ? 'Ausgezahlt' : 'Paid'}</span>
    return null
  }

  if (!canUse) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <p className="text-sm text-zinc-500">
          {lang === 'de'
            ? 'Nur Raidleiter, Offiziere und Admins können Auszahlungen berechnen.'
            : 'Only raid leaders, officers and admins can calculate payouts.'}
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

      {/* ── Kampfberichte-Liste ── */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            ⚔️ {lang === 'de' ? 'Kampfberichte' : 'Battle Reports'}
          </h3>
          <InfoTooltip
            de="Wähle einen Kampfbericht aus um die Auszahlungen zu berechnen oder einzusehen."
            en="Select a battle report to calculate or view payouts."
            lang={lang}
            position="bottom"
          />
          <button
            onClick={fetchReports}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ↺
          </button>
        </div>

        {loadingReports ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-500 text-center">
            {lang === 'de' ? 'Noch keine Kampfberichte vorhanden.' : 'No battle reports yet.'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => handleSelectReport(report.id)}
                className={'w-full text-left px-5 py-3 transition-colors ' + (
                  selectedId === report.id
                    ? 'bg-blue-500/10 border-l-2 border-blue-500'
                    : 'hover:bg-zinc-800/20'
                )}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200">
                      {'KW ' + report.battle_kw + '/' + report.battle_year}
                    </span>
                    <span className="text-xs text-zinc-500">{formatDate(report.battle_date)}</span>
                    <span className="text-xs text-zinc-600">
                      {report.side === 'attacker'
                        ? (lang === 'de' ? '⚔️ Angreifer' : '⚔️ Attacker')
                        : (lang === 'de' ? '🛡️ Verteidiger' : '🛡️ Defender')
                      }
                    </span>
                    {statusBadge(report.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {report.status !== 'draft' && (
                      <span>
                        {report.eligible_count + '/' + report.recipient_count}
                        {' ' + (lang === 'de' ? 'berechtigt' : 'eligible')}
                      </span>
                    )}
                    <span className="text-zinc-700">{'@' + report.created_by_name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Detailansicht ── */}
      {selectedReport && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                {lang === 'de' ? 'Auszahlungsvorschau' : 'Payout Preview'}
              </h3>
              {statusBadge(selectedReport.status)}
              <InfoTooltip
                de="Grün = berechtigt (Bedingungen erfüllt). Grau = nicht berechtigt. Raidleiter sind automatisch berechtigt und erhalten den doppelten Betrag."
                en="Green = eligible (conditions met). Grey = not eligible. Raid leaders are automatically eligible and receive double amounts."
                lang={lang}
                position="bottom"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Berechnen — für RL, Offizier, Admin; nur wenn draft oder neu berechnen */}
              {selectedReport.status !== 'paid' && (
                <button
                  onClick={handleCalculate}
                  disabled={calculating}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {calculating
                    ? (lang === 'de' ? 'Berechne...' : 'Calculating...')
                    : (selectedReport.status === 'draft'
                        ? (lang === 'de' ? '⚡ Berechnen' : '⚡ Calculate')
                        : (lang === 'de' ? '↺ Neu berechnen' : '↺ Recalculate')
                      )
                  }
                </button>
              )}
              {/* Freigeben — nur Admin, nur wenn calculated */}
              {isAdmin && selectedReport.status === 'calculated' && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {approving
                    ? (lang === 'de' ? 'Freigeben...' : 'Approving...')
                    : ('✓ ' + (lang === 'de' ? 'Als ausgezahlt markieren' : 'Mark as paid'))
                  }
                </button>
              )}
            </div>
          </div>

          {/* Berichts-Metadaten */}
          <div className="px-5 py-3 bg-zinc-800/20 border-b border-zinc-800/50 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>{'📅 ' + formatDate(selectedReport.battle_date)}</span>
            <span>{'📋 KW ' + selectedReport.battle_kw + '/' + selectedReport.battle_year}</span>
            <span>{selectedReport.side === 'attacker' ? '⚔️ ' + (lang === 'de' ? 'Angreifer' : 'Attacker') : '🛡️ ' + (lang === 'de' ? 'Verteidiger' : 'Defender')}</span>
            {selectedReport.status !== 'draft' && (
              <span className="text-blue-400/70">
                {lang === 'de'
                  ? 'Schwellwert KW ' + selectedReport.battle_kw + ': ' + formatAmount((selectedReport.battle_kw - 2) * 5000000) + ' pro Ressource'
                  : 'Threshold KW ' + selectedReport.battle_kw + ': ' + formatAmount((selectedReport.battle_kw - 2) * 5000000) + ' per resource'
                }
              </span>
            )}
          </div>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selectedReport.status === 'draft' ? (
            <div className="px-5 py-6 text-sm text-zinc-500 text-center">
              {lang === 'de'
                ? 'Noch nicht berechnet. Klicke "Berechnen" um die Auszahlungen zu ermitteln.'
                : 'Not yet calculated. Click "Calculate" to determine payouts.'}
            </div>
          ) : details.length === 0 ? (
            <div className="px-5 py-6 text-sm text-zinc-500 text-center">
              {lang === 'de' ? 'Keine Auszahlungsdaten.' : 'No payout data.'}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">

              {/* Berechtigte Spieler */}
              {eligiblePlayers.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-emerald-500/5 border-b border-zinc-800/50">
                    <span className="text-xs font-medium text-emerald-400">
                      {'✓ ' + (lang === 'de' ? 'Berechtigt' : 'Eligible') + ' (' + eligiblePlayers.length + ')'}
                    </span>
                  </div>
                  {eligiblePlayers.map((player) => (
                    <div key={player.recipient_id} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200">{player.ingame_name}</span>
                          {selectedReport.status === 'paid' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                              {lang === 'de' ? 'Ausgezahlt' : 'Paid'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {RESOURCE_ORDER.filter(r => (player.resources[r] ?? 0) > 0).map(r => (
                            <span key={r} className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                              {RESOURCE_LABELS[r] + ' ' + formatAmount(player.resources[r])}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Nicht berechtigte Spieler */}
              {ineligiblePlayers.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-zinc-800/20 border-b border-zinc-800/50">
                    <span className="text-xs font-medium text-zinc-500">
                      {'✗ ' + (lang === 'de' ? 'Nicht berechtigt' : 'Not eligible') + ' (' + ineligiblePlayers.length + ')'}
                    </span>
                    <InfoTooltip
                      de="Bedingung 1 (≥10.000 T4+ Verletzte) oder Bedingung 2 (3/5 Ressourcen über Schwellwert) nicht erfüllt."
                      en="Condition 1 (≥10,000 T4+ wounded) or condition 2 (3/5 resources above threshold) not met."
                      lang={lang}
                      position="bottom"
                    />
                  </div>
                  {ineligiblePlayers.map((player) => (
                    <div key={player.recipient_id} className="px-5 py-3 opacity-50">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-zinc-400">{player.ingame_name}</span>
                        <div className="flex flex-wrap gap-2">
                          {RESOURCE_ORDER.filter(r => (player.resources[r] ?? 0) > 0).map(r => (
                            <span key={r} className="text-xs text-zinc-600 bg-zinc-800/40 border border-zinc-700/30 rounded px-2 py-0.5">
                              {RESOURCE_LABELS[r] + ' ' + formatAmount(player.resources[r])}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      )}

    </div>
  )
}
