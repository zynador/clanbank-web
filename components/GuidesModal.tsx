'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type Lang = 'de' | 'en'
type GuideCategory = 'game' | 'app'

interface Guide {
  id: string
  title_de: string
  title_en: string
  file: string
}

const GAME_GUIDES: Guide[] = [
  { id: 'formationen', title_de: 'Formationen', title_en: 'Formations', file: 'formationen' },
  { id: 'turmkampf', title_de: 'Turmkampf', title_en: 'Tower Battle', file: 'turmkampf' },
  { id: 'waffen', title_de: 'Einsatz der Waffen', title_en: 'Use of Weapons', file: 'waffen' },
  { id: 't4', title_de: 'T4 freischalten', title_en: 'Unlock T4', file: 't4' },
  { id: 'spiel-ziele', title_de: 'Spiel & Ziele', title_en: 'Game & Goals', file: 'spiel-ziele' },
  { id: 'leitgedanke', title_de: 'Leitgedanke #171', title_en: 'Vision #171', file: 'leitgedanke' },
]

const APP_GUIDES: Guide[] = []

interface Props {
  lang: Lang
  onClose: () => void
  isDemo?: boolean
}

function flushListBuffer(items: string[], result: ReactNode[], key: { v: number }) {
  if (items.length === 0) return
  result.push(
    <ul key={key.v++} className="list-disc pl-5 space-y-1 text-sm text-gray-300 mb-3">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
  items.length = 0
}

function parseLineToNode(line: string, k: number): ReactNode | null {
  if (line.startsWith('# ')) return <h1 key={k} className="text-lg font-bold text-teal-400 mb-3 mt-2">{line.slice(2)}</h1>
  if (line.startsWith('## ')) return <h2 key={k} className="text-base font-semibold text-gray-200 mb-2 mt-5 border-b border-gray-700 pb-1">{line.slice(3)}</h2>
  if (line.startsWith('### ')) return <h3 key={k} className="text-sm font-semibold text-teal-300 mb-1 mt-3">{line.slice(4)}</h3>
  if (line.trim() !== '') return <p key={k} className="text-sm text-gray-300 mb-2 leading-relaxed">{line}</p>
  return null
}

function parseMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n')
  const result: ReactNode[] = []
  const listBuffer: string[] = []
  const key = { v: 0 }
  for (const line of lines) {
    if (line.startsWith('- ')) { listBuffer.push(line.slice(2)); continue }
    flushListBuffer(listBuffer, result, key)
    const node = parseLineToNode(line, key.v++)
    if (node) result.push(node)
  }
  flushListBuffer(listBuffer, result, key)
  return result
}

async function loadGuideContent(category: GuideCategory, file: string, lang: Lang): Promise<string> {
  const base = '/guides/' + category + '/' + file
  const res = await fetch(base + '-' + lang + '.md')
  if (!res.ok && lang === 'en') {
    const fallback = await fetch(base + '-de.md')
    return fallback.ok ? await fallback.text() : 'Guide not available.'
  }
  return res.ok ? await res.text() : (lang === 'de' ? 'Guide nicht verfügbar.' : 'Guide not available.')
}

function GuidesList({ guides, selected, onSelect, lang }: {
  guides: Guide[]
  selected: string | null
  onSelect: (id: string) => void
  lang: Lang
}) {
  if (guides.length === 0) {
    return (
      <p className="text-xs text-gray-500 p-4 leading-relaxed">
        {lang === 'de' ? 'Noch keine Guides verfügbar.' : 'No guides available yet.'}
      </p>
    )
  }
  return (
    <ul className="space-y-0.5 p-2">
      {guides.map(g => (
        <li key={g.id}>
          <button
            onClick={() => onSelect(g.id)}
            className={
              'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ' +
              (selected === g.id
                ? 'bg-teal-900/40 text-teal-300 font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')
            }
          >
            {lang === 'de' ? g.title_de : g.title_en}
          </button>
        </li>
      ))}
    </ul>
  )
}

function GuideContent({ content, loading, lang }: {
  content: string | null
  loading: boolean
  lang: Lang
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        {lang === 'de' ? '⏳ Lädt...' : '⏳ Loading...'}
      </div>
    )
  }
  if (!content) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        {lang === 'de' ? '← Guide auswählen' : '← Select a guide'}
      </div>
    )
  }
  return <div>{parseMarkdown(content)}</div>
}

function ModalHeader({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
      <h2 className="text-base font-semibold text-gray-200">
        {'📚 ' + (lang === 'de' ? 'Guides' : 'Guides')}
      </h2>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-300 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800"
        aria-label="Schließen"
      >
        {'✕'}
      </button>
    </div>
  )
}

function CategoryTabs({ category, onChange, lang }: {
  category: GuideCategory
  onChange: (cat: GuideCategory) => void
  lang: Lang
}) {
  return (
    <div className="flex border-b border-gray-700 px-4 flex-shrink-0">
      {(['game', 'app'] as GuideCategory[]).map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={
            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ' +
            (category === cat
              ? 'border-teal-500 text-teal-400'
              : 'border-transparent text-gray-500 hover:text-gray-300')
          }
        >
          {cat === 'game'
            ? ('🎮 ' + (lang === 'de' ? 'Spiel' : 'Game'))
            : ('📱 ' + (lang === 'de' ? 'App' : 'App'))}
        </button>
      ))}
    </div>
  )
}

function DemoPlaceholder({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const isDE = lang === 'de'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#111111', border: '0.5px solid rgba(201,168,76,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '0.5px solid rgba(201,168,76,0.12)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'rgba(201,168,76,0.8)' }}
          >
            {'📚 ' + (isDE ? 'Guides' : 'Guides')}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none w-7 h-7 flex items-center justify-center rounded"
            style={{ color: 'rgba(201,168,76,0.4)' }}
            aria-label="Schließen"
          >
            {'✕'}
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 py-10 gap-4">
          <div style={{ fontSize: '2.5rem' }}>{'📖'}</div>

          <p
            className="font-semibold text-base"
            style={{ fontFamily: 'Georgia, serif', color: '#E8C87A' }}
          >
            {isDE ? 'Clan-Guides' : 'Clan Guides'}
          </p>

          <div style={{ width: 32, height: '0.5px', background: 'rgba(201,168,76,0.25)' }} />

          <p
            className="text-sm leading-relaxed max-w-xs"
            style={{ color: 'rgba(201,168,76,0.5)' }}
          >
            {isDE
              ? 'Hier können clan-spezifische Guides hochgeladen werden — von Spielstrategien bis zu App-Anleitungen. Im Live-Betrieb steht hier das Wissen eures Clans.'
              : 'Clan-specific guides can be uploaded here — from game strategies to app tutorials. In live operation, this is where your clan\'s knowledge lives.'}
          </p>

          <div
            className="w-full rounded-lg px-4 py-3 text-xs leading-relaxed"
            style={{
              background: 'rgba(201,168,76,0.05)',
              border: '0.5px solid rgba(201,168,76,0.15)',
              color: 'rgba(201,168,76,0.4)',
            }}
          >
            {'🎬 ' + (isDE
              ? 'Demo-Modus — Inhalte sind nicht öffentlich sichtbar.'
              : 'Demo mode — content is not publicly visible.')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GuidesModal({ lang, onClose, isDemo }: Props) {
  const [category, setCategory] = useState<GuideCategory>('game')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isDemo) {
    return <DemoPlaceholder lang={lang} onClose={onClose} />
  }

  const guides = category === 'game' ? GAME_GUIDES : APP_GUIDES
  const selectedGuide = guides.find(g => g.id === selectedId) ?? null

  async function handleSelect(id: string) {
    setSelectedId(id)
    setContent(null)
    setLoading(true)
    const guide = guides.find(g => g.id === id)
    if (!guide) { setLoading(false); return }
    const text = await loadGuideContent(category, guide.file, lang)
    setContent(text)
    setLoading(false)
  }

  function handleCategoryChange(cat: GuideCategory) {
    setCategory(cat)
    setSelectedId(null)
    setContent(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-[#161822] border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader lang={lang} onClose={onClose} />
        <CategoryTabs category={category} onChange={handleCategoryChange} lang={lang} />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-gray-700 overflow-y-auto flex-shrink-0">
            <GuidesList guides={guides} selected={selectedId} onSelect={handleSelect} lang={lang} />
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {selectedGuide && (
              <p className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-800">
                {lang === 'de' ? selectedGuide.title_de : selectedGuide.title_en}
              </p>
            )}
            <GuideContent content={content} loading={loading} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  )
}
