'use client'

import { HelpCircle } from 'lucide-react'

interface HelpButtonProps {
  onClick: () => void
  lang?: 'de' | 'en'
}

export default function HelpButton({ onClick, lang = 'de' }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      title={lang === 'de' ? 'Hilfe & Anleitung' : 'Help & Guide'}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#161822] hover:bg-[#1e2030] border border-gray-700 hover:border-teal-600 text-gray-400 hover:text-teal-400 px-3 py-2.5 rounded-full shadow-lg transition-all duration-200 group"
    >
      <HelpCircle size={18} />
      <span className="text-xs font-medium max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
        {lang === 'de' ? 'Anleitung' : 'Guide'}
      </span>
    </button>
  )
}
