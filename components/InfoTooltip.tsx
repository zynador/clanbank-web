'use client'
import { useState, useRef, useEffect } from 'react'

interface InfoTooltipProps {
  de: string
  en: string
  lang?: 'de' | 'en'
  position?: 'top' | 'bottom'
}

export default function InfoTooltip({
  de,
  en,
  lang = 'de',
  position = 'bottom',
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  function showTooltip() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({
        top: position === 'bottom'
          ? rect.bottom + 6
          : rect.top - 6,
        left: rect.left + rect.width / 2,
      })
    }
    setVisible(true)
  }

  useEffect(() => {
    if (!visible) return
    const close = () => setVisible(false)
    window.addEventListener('scroll', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
    }
  }, [visible])

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setVisible(false)}
        onClick={(e) => { e.stopPropagation(); setVisible(v => !v) }}
        className="inline-flex items-center justify-center w-5 h-5 ml-1.5 rounded-full bg-teal-900/60 border border-teal-700 text-teal-400 hover:bg-teal-700 hover:text-white transition-colors text-xs font-bold"
        aria-label="Info"
        type="button"
      >
        i
      </button>
      {visible && (
        <span
          style={{
            position: 'fixed',
            top: position === 'bottom' ? coords.top : undefined,
            bottom: position === 'top'
              ? window.innerHeight - coords.top + 6
              : undefined,
            left: coords.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="w-64 bg-[#0f1117] border border-teal-800 text-gray-300 text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-normal pointer-events-none"
        >
          {lang === 'de' ? de : en}
        </span>
      )}
    </span>
  )
}
