'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Alert = {
  id: string
  attempted_by: string
  player_name: string
  screenshot_hash: string
  created_at: string
  dismissed_at: string | null
}
type Lang = 'de' | 'en'

export default function SecurityAlerts({
  lang,
  onCountChange,
}: {
  lang: Lang
  onCountChange?: (n: number) => void
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAlerts() {
    setLoading(true)
    const { data } = await supabase.rpc('get_security_alerts')
    const list = (data as Alert[]) || []
    setAlerts(list)
    onCountChange?.(list.filter((a) => !a.dismissed_at).length)
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  async function dismiss(id: string) {
    await supabase.rpc('dismiss_security_alert', { p_alert_id: id })
    fetchAlerts()
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const active    = alerts.filter((a) => !a.dismissed_at)
  const dismissed = alerts.filter((a) => a.dismissed_at)

  const t = {
    title:     { de: 'Sicherheitswarnungen',                       en: 'Security alerts' },
    empty:     { de: 'Keine aktiven Warnungen.',                   en: 'No active alerts.' },
    attempt:   { de: 'hat versucht, einen bereits verwendeten Screenshot hochzuladen.', en: 'attempted to upload an already-used screenshot.' },
    hash:      { de: 'Hash',                                       en: 'Hash' },
    dismiss:   { de: 'Erledigt',                                   en: 'Dismiss' },
    oldTitle:  { de: 'Erledigte Warnungen',                        en: 'Dismissed alerts' },
  }

  if (loading) return <p className="text-sm text-gray-500">Lade...</p>

  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium text-gray-300">{t.title[lang]}</h2>

      {active.length === 0 ? (
        <p className="text-sm text-gray-500">{t.empty[lang]}</p>
      ) : (
        <div className="space-y-2">
          {active.map((a) => (
            <div key={a.id} className="border border-yellow-800/50 bg-yellow-900/10 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-yellow-400 mb-1">⚠️ Duplikat-Versuch</p>
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">{a.player_name}</span>{' '}
                    {t.attempt[lang]}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t.hash[lang]}: <span className="font-mono">{a.screenshot_hash.slice(0, 12)}…</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{formatDate(a.created_at)}</p>
                </div>
                <button
                  onClick={() => dismiss(a.id)}
                  className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-2 py-1 shrink-0"
                >
                  {t.dismiss[lang]}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dismissed.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
            {t.oldTitle[lang]} ({dismissed.length})
          </summary>
          <div className="space-y-2 mt-2 opacity-50">
            {dismissed.map((a) => (
              <div key={a.id} className="border border-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-400">
                  <span className="font-medium">{a.player_name}</span>{' '}
                  {t.attempt[lang]}
                </p>
                <p className="text-xs text-gray-600 mt-1">{formatDate(a.created_at)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
