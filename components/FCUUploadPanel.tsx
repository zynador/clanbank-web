'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface Props {
  lang: Lang
  eventId: string
  onBack: () => void
  onDone: () => void
}

type SlotStatus = 'empty' | 'uploading' | 'ocr' | 'done' | 'error'

type Slot = {
  id: number
  file: File | null
  url: string
  hash: string
  status: SlotStatus
  rowCount: number
  error: string
}

type OcrRow = {
  rank: number
  ingame_name: string
  points: number
}

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

function makeSlot(id: number): Slot {
  return { id, file: null, url: '', hash: '', status: 'empty', rowCount: 0, error: '' }
}

export default function FCUUploadPanel({ lang, eventId, onBack, onDone }: Props) {
  const { profile } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([makeSlot(0)])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const t = {
    title:      lang === 'de' ? 'Screenshots hochladen' : 'Upload Screenshots',
    hint:       lang === 'de' ? 'Lade alle scrollbaren Seiten der FCU-Rangliste hoch.' : 'Upload all scrolled pages of the FCU ranking.',
    addSlot:    lang === 'de' ? '+ Weiterer Screenshot' : '+ Add Screenshot',
    next:       lang === 'de' ? 'Weiter zu Ergebnissen →' : 'Continue to Results →',
    back:       lang === 'de' ? '← Zurück' : '← Back',
    uploading:  lang === 'de' ? 'Wird hochgeladen...' : 'Uploading...',
    ocr:        lang === 'de' ? 'OCR läuft...' : 'Running OCR...',
    rows:       lang === 'de' ? 'Zeilen erkannt' : 'rows detected',
    error:      lang === 'de' ? 'Fehler' : 'Error',
    select:     lang === 'de' ? 'Bild auswählen' : 'Select image',
    saveError:  lang === 'de' ? 'Fehler beim Speichern.' : 'Error saving.',
  }

  function updateSlot(id: number, patch: Partial<Slot>) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function handleFile(slotId: number, file: File) {
    updateSlot(slotId, { file, status: 'uploading', error: '' })

    try {
      const hash = await sha256(file)
      const ext = file.name.split('.').pop() || 'jpg'
      const path = 'fcu/' + eventId + '/' + slotId + '_' + hash.slice(0, 8) + '.' + ext

      const { error: upErr } = await supabase.storage
        .from('screenshots')
        .upload(path, file, { upsert: true })

      if (upErr) throw new Error(upErr.message)

      const { data: urlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(path)

      const url = urlData.publicUrl
      updateSlot(slotId, { url, hash, status: 'ocr' })

      // OCR
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url, mode: 'fcu' }),
      })

      if (!ocrRes.ok) throw new Error('OCR fehlgeschlagen')
      const ocrData = await ocrRes.json()
      const rows: OcrRow[] = ocrData.results ?? []

      // Screen in DB speichern
      await supabase.from('fcu_event_screens').upsert({
        fcu_event_id: eventId,
        slot_index:   slotId,
        url,
        hash,
      })

      // OCR-Ergebnisse in sessionStorage mergen
      const key = 'fcu_ocr_' + eventId
      const existing: OcrRow[] = JSON.parse(sessionStorage.getItem(key) || '[]')
      const merged = [...existing]
      for (const row of rows) {
        if (!merged.find(r => r.rank === row.rank)) {
          merged.push(row)
        }
      }
      merged.sort((a, b) => a.rank - b.rank)
      sessionStorage.setItem(key, JSON.stringify(merged))

      updateSlot(slotId, { status: 'done', rowCount: rows.length })

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      updateSlot(slotId, { status: 'error', error: msg })
    }
  }

  function addSlot() {
    setSlots(prev => [...prev, makeSlot(prev.length)])
  }

  function removeSlot(id: number) {
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const doneCount = slots.filter(s => s.status === 'done').length
  const busyCount = slots.filter(s => s.status === 'uploading' || s.status === 'ocr').length
  const canProceed = doneCount > 0 && busyCount === 0

  function handleProceed() {
    onDone()
  }

  return (
    <div className="p-4 space-y-4">

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          {t.back}
        </button>
        <h2 className="text-lg font-semibold">{t.title}</h2>
      </div>

      <p className="text-sm text-gray-500">{t.hint}</p>

      <div className="space-y-2">
        {slots.map((slot, idx) => (
          <div key={slot.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">
                {'Screenshot ' + (idx + 1)}
              </span>
              {slots.length > 1 && slot.status === 'empty' && (
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>

            {slot.status === 'empty' && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={el => { fileRefs.current[slot.id] = el }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(slot.id, f)
                  }}
                />
                <button
                  onClick={() => fileRefs.current[slot.id]?.click()}
                  className="w-full py-3 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50"
                >
                  📷 {t.select}
                </button>
              </div>
            )}

            {slot.status === 'uploading' && (
              <div className="text-sm text-blue-600 py-2">⏳ {t.uploading}</div>
            )}

            {slot.status === 'ocr' && (
              <div className="text-sm text-purple-600 py-2">🔍 {t.ocr}</div>
            )}

            {slot.status === 'done' && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-green-700">
                  {'✅ ' + slot.rowCount + ' ' + t.rows}
                </div>
                <button
                  onClick={() => {
                    updateSlot(slot.id, { status: 'empty', file: null, url: '', hash: '', rowCount: 0 })
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ↩ {lang === 'de' ? 'Ersetzen' : 'Replace'}
                </button>
              </div>
            )}

            {slot.status === 'error' && (
              <div className="text-sm text-red-600 py-1">
                {'⚠️ ' + t.error + ': ' + slot.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addSlot}
        className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
      >
        {t.addSlot}
      </button>

      {feedback && <p className="text-red-600 text-sm">{feedback}</p>}

      <button
        onClick={handleProceed}
        disabled={!canProceed}
        className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
      >
        {t.next}
      </button>

      {doneCount > 0 && (
        <p className="text-center text-xs text-gray-400">
          {doneCount + ' ' + (lang === 'de' ? 'Screenshot(s) verarbeitet' : 'screenshot(s) processed')}
        </p>
      )}

    </div>
  )
}
