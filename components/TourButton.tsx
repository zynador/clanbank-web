'use client'

interface Props {
  onClick: () => void
  lang: 'de' | 'en'
}

export default function TourButton({ onClick, lang }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-teal-700 hover:bg-teal-600 text-white text-xl shadow-lg flex items-center justify-center transition-colors border border-teal-500/30"
      style={{ zIndex: 30 }}
      title={lang === 'de' ? 'Einführungstour starten' : 'Start guided tour'}
      aria-label={lang === 'de' ? 'Tour starten' : 'Start tour'}
    >
      {'?'}
    </button>
  )
}
