'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth-context'

type Lang = 'de' | 'en'

interface Props {
  lang: Lang
}

type Announcement = {
  id: string
  title: string
  content: string | null
  pinned: boolean
  created_at: string
}

export default function AnnouncementWidget({ lang }: Props) {
  const { profile } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const isAdmin = profile?.role === 'admin'

  const t = {
    newAnnouncement: lang === 'de' ? 'Ankündigung erstellen' : 'Create Announcement',
    titlePlaceholder: lang === 'de' ? 'Titel...' : 'Title...',
    contentPlaceholder: lang === 'de' ? 'Nachricht (optional)...' : 'Message (optional)...',
    pin: lang === 'de' ? 'Anpinnen' : 'Pin',
    save: lang === 'de' ? 'Veröffentlichen' : 'Publish',
    cancel: lang === 'de' ? 'Abbrechen' : 'Cancel',
    delete: lang === 'de' ? 'Löschen' : 'Delete',
    noItems: lang === 'de' ? 'Keine Ankündigungen.' : 'No announcements.',
    pinned: lang === 'de' ? 'Angepinnt' : 'Pinned',
  }

  useEffect(() => {
    loadItems()
  }, [profile])

  async function loadItems() {
    if (!profile?.clan_id) return
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, pinned, created_at')
      .eq('clan_id', profile.clan_id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setFeedback('')
    const { data, error } = await supabase.rpc('create_announcement', {
      p_clan_id: profile!.clan_id,
      p_title:   title.trim(),
      p_content: content.trim() || null,
      p_pinned:  pinned,
    })
    setSaving(false)
    if (error || !data?.success) {
      setFeedback(data?.message || (lang === 'de' ? 'Fehler.' : 'Error.'))
      return
    }
    setTitle('')
    setContent('')
    setPinned(false)
    setShowForm(false)
    await loadItems()
  }

  async function handleDelete(id: string) {
    await supabase.rpc('delete_announcement', { p_announcement_id: id })
    await loadItems()
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return (lang === 'de' ? 'vor ' + mins + ' Min.' : mins + 'm ago')
    if (hours < 24) return (lang === 'de' ? 'vor ' + hours + ' Std.' : hours + 'h ago')
    return (lang === 'de' ? 'vor ' + days + ' Tag(en)' : days + 'd ago')
  }

  if (loading) return null

  return (
    <div className="space-y-2">

      {/* Admin: neues Formular */}
      {isAdmin && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
            >
              + {t.newAnnouncement}
            </button>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <input
                type="text"
                placeholder={t.titlePlaceholder}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <textarea
                placeholder={t.contentPlaceholder}
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
              />
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={e => setPinned(e.target.checked)}
                />
                📌 {t.pin}
              </label>
              {feedback && <p className="text-red-600 text-xs">{feedback}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="flex-1 bg-blue-600 text-white rounded py-2 text-xs disabled:opacity-40"
                >
                  {saving ? '...' : t.save}
                </button>
                <button
                  onClick={() => { setShowForm(false); setFeedback('') }}
                  className="flex-1 border border-gray-300 rounded py-2 text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liste */}
      {items.length === 0 && !isAdmin ? null : items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">{t.noItems}</p>
      ) : (
        items.map(item => (
          <div
            key={item.id}
            className={
              'bg-white rounded-lg px-3 py-3 border ' +
              (item.pinned ? 'border-blue-200' : 'border-gray-100')
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {item.pinned && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      📌 {t.pinned}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-800 leading-snug">{item.title}</p>
                {item.content && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.content}</p>
                )}
                <p className="text-xs text-gray-400 mt-1.5">{timeAgo(item.created_at)}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 mt-0.5"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
