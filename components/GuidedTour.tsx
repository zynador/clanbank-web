'use client'
import { useEffect, useState } from 'react'

type UserRole = 'admin' | 'offizier' | 'mitglied'

export interface TourStep {
  id: string
  targetSelector: string   // Wert von data-tour-id (kein CSS-Prefix)
  tab: string
  title: string
  body: string
  roles: UserRole[]
}

interface Props {
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
  onNavigate: (tab: string) => void
  lang: 'de' | 'en'
}

interface Hl {
  rect: DOMRect
  ttop: number
  tleft: number
}

const TW = 284

function calcPos(rect: DOMRect): { ttop: number; tleft: number } {
  const PAD = 14
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (rect.right + TW + PAD < vw) return { ttop: rect.top, tleft: rect.right + PAD }
  if (rect.left - TW - PAD > 0) return { ttop: rect.top, tleft: rect.left - TW - PAD }
  const ttop = rect.bottom + 200 < vh
    ? rect.bottom + PAD
    : Math.max(PAD, rect.top - 200 - PAD)
  return { ttop, tleft: Math.max(PAD, Math.min(rect.left, vw - TW - PAD)) }
}

function resolveHl(selector: string): Hl | null {
  const el = document.querySelector('[data-tour-id="' + selector + '"]')
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { rect, ...calcPos(rect) }
}

export default function GuidedTour({ steps, onComplete, onSkip, onNavigate, lang }: Props) {
  const [idx, setIdx] = useState(0)
  const [hl, setHl] = useState<Hl | null>(null)
  const step = steps[idx]
  const isLast = idx === steps.length - 1

  useEffect(() => {
    setHl(null)
    onNavigate(step.tab)
    const t1 = setTimeout(() => {
      const el = document.querySelector('[data-tour-id="' + step.targetSelector + '"]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    const t2 = setTimeout(() => setHl(resolveHl(step.targetSelector)), 750)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onSkip(); return }
      if (e.key === 'ArrowRight') { isLast ? onComplete() : setIdx(i => i + 1) }
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(i => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, isLast, onComplete, onSkip])

  if (!step) return null

  const de = lang === 'de'
  const counter = (idx + 1) + ' / ' + steps.length
  const lblSkip = de ? 'Beenden' : 'End'
  const lblBack = de ? '← Zurück' : '← Back'
  const lblNext = isLast ? (de ? '✅ Fertig' : '✅ Done') : (de ? 'Weiter →' : 'Next →')

  const fallbackTop = typeof window !== 'undefined' ? window.innerHeight - 240 : 500
  const ttop = hl ? hl.ttop : fallbackTop
  const tleft = hl ? hl.tleft : 16

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 40, backgroundColor: 'rgba(0,0,0,0.38)' }}
      />

      {hl && (
        <div
          className="fixed pointer-events-none rounded-lg"
          style={{
            zIndex: 41,
            top: hl.rect.top - 5,
            left: hl.rect.left - 5,
            width: hl.rect.width + 10,
            height: hl.rect.height + 10,
            outline: '2px dashed #14b8a6',
            outlineOffset: '3px',
            boxShadow: '0 0 12px rgba(20,184,166,0.4)',
          }}
        />
      )}

      <div
        className="fixed bg-[#1e2030] border border-teal-600/60 rounded-xl shadow-2xl p-4"
        style={{ zIndex: 50, top: ttop, left: tleft, width: TW }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-teal-400 font-medium">{counter}</span>
          <button
            onClick={onSkip}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {lblSkip}
          </button>
        </div>
        <h3 className="text-sm font-semibold text-white mb-1.5">{step.title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">{step.body}</p>
        <div className="flex gap-2">
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => i - 1)}
              className="flex-1 text-xs border border-gray-600 rounded-lg py-2 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {lblBack}
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setIdx(i => i + 1)}
            className="flex-1 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg py-2 text-white font-medium transition-colors"
          >
            {lblNext}
          </button>
        </div>
      </div>
    </>
  )
}
