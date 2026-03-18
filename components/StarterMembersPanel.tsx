'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Lang = 'de' | 'en'

interface StarterMember {
  id: string
  ingame_name: string
  display_name: string | null
  role: string
  status: string
  claimed_by: string | null
  claimed_at: string | null
}

interface ParsedRow {
  ingame_name: string
  display_name: string
  role: string
}

interface ClaimerInfo {
  id: string
  username: string
  ingame_name: string
}

export default function StarterMembersPanel({ lang }: { lang: Lang }) {
  const [pendingClaims, setPendingClaims] = useState<StarterMember[]>([])
  const [claimers, setClaimers] = useState<Record<string, ClaimerInfo>>({})
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchPendingClaims() }, [])

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(t)
    }
  }, [feedback])

  async function fetchPendingClaims() {
    const { data } = await supabase
      .from('starter_members')
      .select('*')
      .eq('status', 'claimed_pending')
      .order('claimed_at', { ascending: true })
    if (data) {
      setPendingClaims(data as StarterMember[])
      const ids = (data as StarterMember[]).map(r => r.claimed_by).filter(Boolean) as string[]
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, ingame_name')
          .in('id', ids)
        if (profiles) {
          const map: Record<string, ClaimerInfo> = {}
          ;(profiles as ClaimerInfo[]).forEach(p => { map[p.id] = p })
          setClaimers(map)
        }
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setPreview(parseCSV(text))
    }
    reader.readAsText(file, 'UTF-8')
  }

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return []
    const firstLine = lines[0]
    const delimiter = firstLine.includes(';') ? ';' : ','
    const header = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const iIdx = header.findIndex(h => h.includes('ingame') || h === 'name')
    const dIdx = header.findIndex(h => h.includes('display'))
    const rIdx = header.findIndex(h => h.includes('role') || h.includes('rolle'))
    if (iIdx === -1) return []
    return lines.slice(1).map(line => {
    const cols = line.split(delimiter).map(c => c.trim().replace(/"/g, ''))
    const rawName = cols[iIdx] || ''
    const cleanName = rawName.includes(';;') ? rawName.split(';;')[0].trim() : rawName
    const rawRole = rIdx >= 0 ? (cols[rIdx] || '') : ''
    const cleanRole = rawRole.includes(';;') ? rawRole.split(';;')[0].trim() : rawRole
    return {
      ingame_name: cleanName,
      display_name: dIdx >= 0 ? (cols[dIdx] || '') : '',
      role: cleanRole || 'mitglied',
    }
    }).filter(r => r.ingame_name)
  }

  async function handleImport() {
    if (!preview.length) return
    setImporting(true)
    const { data, error } = await supabase.rpc('import_starter_members', { members: preview })
    if (error || !data?.success) {
      setFeedback({ type: 'error', text: error?.message || data?.message || 'Fehler' })
    } else {
      setFeedback({ type: 'success', text: data.message })
      setPreview([])
      if (fileRef.current) fileRef.current.value = ''
    }
    setImporting(false)
  }

  async function handleConfirm(id: string) {
    setProcessing(id)
    const { data, error } = await supabase.rpc('confirm_starter_claim', { starter_id: id })
    if (error || !data?.success) {
      setFeedback({ type: 'error', text: error?.message || data?.message })
    } else {
      setFeedback({ type: 'success', text: data.message })
      fetchPendingClaims()
    }
    setProcessing(null)
  }

  async function handleReject(id: string) {
    setProcessing(id)
    const { data, error } = await supabase.rpc('reject_starter_claim', { starter_id: id })
    if (error || !data?.success) {
      setFeedback({ type: 'error', text: error?.message || data?.message })
    } else {
      setFeedback({ type: 'success', text: data.message })
      fetchPendingClaims()
    }
    setProcessing(null)
  }

  return (
    <div className="space-y-6">

      {feedback && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>{feedback.text}</div>
      )}

      {/* CSV Import */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          {lang === 'de' ? 'Starter-Mitglieder importieren' : 'Import Starter Members'}
        </h3>
        <p className="text-xs text-zinc-500">
          {lang === 'de'
            ? 'CSV-Datei mit Spalten: ingame_name, display_name (optional), role (optional). Erste Zeile = Kopfzeile.'
            : 'CSV file with columns: ingame_name, display_name (optional), role (optional). First row = header.'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-300 hover:file:bg-zinc-600 file:cursor-pointer"
        />

        {preview.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              {lang === 'de' ? `${preview.length} Einträge erkannt:` : `${preview.length} entries detected:`}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 divide-y divide-zinc-800">
              {preview.slice(0, 20).map((row, i) => (
                <div key={i} className="px-3 py-2 text-xs text-zinc-300 flex gap-4">
                  <span className="font-medium">{row.ingame_name}</span>
                  {row.display_name && <span className="text-zinc-500">{row.display_name}</span>}
                  <span className="text-zinc-600 ml-auto">{row.role}</span>
                </div>
              ))}
              {preview.length > 20 && (
                <div className="px-3 py-2 text-xs text-zinc-500">
                  {lang === 'de' ? `... und ${preview.length - 20} weitere` : `... and ${preview.length - 20} more`}
                </div>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {importing
                ? (lang === 'de' ? 'Importiere...' : 'Importing...')
                : (lang === 'de' ? `${preview.length} Mitglieder importieren` : `Import ${preview.length} members`)}
            </button>
          </div>
        )}
      </div>

      {/* Pending Claims */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {lang === 'de'
              ? `Ausstehende Zuordnungen (${pendingClaims.length})`
              : `Pending Claims (${pendingClaims.length})`}
          </h3>
        </div>

        {pendingClaims.length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-500 text-center">
            {lang === 'de' ? 'Keine ausstehenden Zuordnungen.' : 'No pending claims.'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {pendingClaims.map((claim) => {
              const claimer = claim.claimed_by ? claimers[claim.claimed_by] : null
              return (
                <div key={claim.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="font-medium text-zinc-200">{claim.ingame_name}</span>
                    <span className="text-zinc-500 ml-2 text-xs">
                      {lang === 'de' ? '← beansprucht von' : '← claimed by'}{' '}
                      <span className="text-zinc-300">
                        {claimer ? `@${claimer.username}` : '...'}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleConfirm(claim.id)}
                      disabled={processing === claim.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                    >
                      ✓ {lang === 'de' ? 'Bestätigen' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => handleReject(claim.id)}
                      disabled={processing === claim.id}
                      className="px-3 py-1.5 bg-red-600/70 hover:bg-red-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                    >
                      ✗ {lang === 'de' ? 'Ablehnen' : 'Reject'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
