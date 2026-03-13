'use client'

import { useState } from 'react'

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
  position = 'top',
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="text-gray-600 hover:text-teal-400 transition-colors ml-1 align-middle text-xs leading-none"
        aria-label="Info"
        type="button"
      >
        ⓘ
      </button>

      {visible && (
        <span
          className={`absolute ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2 w-64 bg-[#0f1117] border border-gray-600 text-gray-300 text-xs rounded-lg px-3 py-2 shadow-xl z-50 leading-relaxed whitespace-normal pointer-events-none`}
        >
          {lang === 'de' ? de : en}
        </span>
      )}
    </span>
  )
}
