'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Globe } from 'lucide-react'

type Role = 'admin' | 'offizier' | 'mitglied'
type Lang = 'de' | 'en'

interface Step {
  icon: string
  title: { de: string; en: string }
  text: { de: string; en: string }
}

const steps: Record<Role, Step[]> = {
  mitglied: [
    {
      icon: '🏦',
      title: { de: 'Willkommen bei 1Ca – BANK', en: 'Welcome to 1Ca – BANK' },
      text: {
        de: 'Hier werden alle Clan-Einzahlungen transparent und revisionssicher verwaltet. Diese kurze Anleitung zeigt dir, wie alles funktioniert.',
        en: 'All clan deposits are managed here transparently and audit-proof. This short guide shows you how everything works.',
      },
    },
    {
      icon: '📸',
      title: { de: 'Schritt 1: Ressourcen senden', en: 'Step 1: Send Resources' },
      text: {
        de: 'Schicke im Spiel Ressourcen an „Bam bamm" (das ist die Clan-Bank). Mach danach sofort einen Screenshot von der Transaktion.',
        en: 'Send resources in-game to "Bam bamm" (that\'s the clan bank). Take a screenshot of the transaction right away.',
      },
    },
    {
      icon: '⬆️',
      title: { de: 'Schritt 2: Screenshot hochladen', en: 'Step 2: Upload Screenshot' },
      text: {
        de: 'Gehe zu „Einzahlungen" und lade deinen Screenshot hoch. Die KI erkennt Ressource und Menge automatisch.',
        en: 'Go to "Deposits" and upload your screenshot. The AI automatically detects resource type and amount.',
      },
    },
    {
      icon: '✅',
      title: { de: 'Schritt 3: Werte prüfen & einzahlen', en: 'Step 3: Verify & Submit' },
      text: {
        de: 'Prüfe die erkannten Werte. Stimmt alles? Klicke „Werte übernehmen" und dann „Einzahlung speichern". Die Einzahlung wird sofort gutgeschrieben.',
        en: 'Check the detected values. Everything correct? Click "Apply Values" then "Save Deposit". The deposit is credited immediately.',
      },
    },
    {
      icon: '⚠️',
      title: { de: 'Manuelle Eingabe = Offizier-Prüfung', en: 'Manual Entry = Officer Review' },
      text: {
        de: 'Gibst du Werte manuell ein (z.B. wenn die KI nicht funktioniert), landet die Einzahlung zur Prüfung bei einem Offizier. Sie zählt erst nach Genehmigung.',
        en: 'If you enter values manually (e.g. if the AI fails), the deposit goes to an Officer for review. It only counts after approval.',
      },
    },
    {
      icon: '📊',
      title: { de: 'Rangliste & Dashboard', en: 'Rankings & Dashboard' },
      text: {
        de: 'Im Dashboard siehst du alle Clan-Beiträge und die Rangliste. Nur genehmigte Einzahlungen zählen. Viel Spaß beim Beitragen! 🎯',
        en: 'The dashboard shows all clan contributions and rankings. Only approved deposits count. Happy contributing! 🎯',
      },
    },
  ],
  offizier: [
    {
      icon: '⚔️',
      title: { de: 'Willkommen, Offizier!', en: 'Welcome, Officer!' },
      text: {
        de: 'Du hast zusätzlich zur normalen Einzahlungsfunktion Zugriff auf die Freigabe-Queue für manuelle Einzahlungen.',
        en: 'In addition to the normal deposit function, you have access to the Approval Queue for manual deposits.',
      },
    },
    {
      icon: '📸',
      title: { de: 'Eigene Einzahlungen', en: 'Your Own Deposits' },
      text: {
        de: 'Funktioniert wie bei einem Mitglied: Screenshot hochladen → KI erkennt Werte → prüfen → „Werte übernehmen" → speichern. Fertig.',
        en: 'Works like a member: upload screenshot → AI detects values → check → "Apply Values" → save. Done.',
      },
    },
    {
      icon: '🔍',
      title: { de: 'Freigabe-Queue prüfen', en: 'Check Approval Queue' },
      text: {
        de: 'Manuelle Einzahlungen erscheinen im Tab „Freigaben". Du siehst Screenshot und eingegebene Werte. Prüfe ob sie übereinstimmen.',
        en: 'Manual deposits appear under the "Approvals" tab. You see the screenshot and entered values. Check if they match.',
      },
    },
    {
      icon: '✅',
      title: { de: 'Genehmigen oder Ablehnen', en: 'Approve or Reject' },
      text: {
        de: 'Alles stimmt → Genehmigen. Screenshot passt nicht → Ablehnen mit Begründung. Der Spieler sieht deinen Grund und kann korrigieren.',
        en: 'Everything matches → Approve. Screenshot doesn\'t match → Reject with reason. The player sees your reason and can correct it.',
      },
    },
    {
      icon: '📊',
      title: { de: 'Dashboard & Rankings', en: 'Dashboard & Rankings' },
      text: {
        de: 'Du siehst alle Clan-Daten inkl. aller Spieler-Einzahlungen. Nur genehmigte Einzahlungen zählen in der Rangliste.',
        en: 'You see all clan data including all player deposits. Only approved deposits count in the rankings.',
      },
    },
  ],
  admin: [
    {
      icon: '👑',
      title: { de: 'Willkommen, Admin!', en: 'Welcome, Admin!' },
      text: {
        de: 'Du hast vollen Zugriff auf alle Funktionen der Clanbank: Einzahlungen, Freigaben und Spieler-Verwaltung.',
        en: 'You have full access to all Clanbank features: deposits, approvals, and player management.',
      },
    },
    {
      icon: '👤',
      title: { de: 'Spieler verwalten', en: 'Manage Players' },
      text: {
        de: 'Unter „Verwaltung" kannst du Rollen vergeben (Mitglied → Offizier → Admin) und Ingame-Namen aktualisieren. Namensänderungen werden automatisch protokolliert.',
        en: 'Under "Management" you can assign roles (Member → Officer → Admin) and update in-game names. Name changes are logged automatically.',
      },
    },
    {
      icon: '🔍',
      title: { de: 'Freigabe-Queue', en: 'Approval Queue' },
      text: {
        de: 'Manuelle Einzahlungen landen im Tab „Freigaben". Du und alle Offiziere können genehmigen oder ablehnen. Du springst ein, wenn keine Offiziere verfügbar sind.',
        en: 'Manual deposits appear under "Approvals". You and all Officers can approve or reject. You step in when no Officers are available.',
      },
    },
    {
      icon: '🔑',
      title: { de: 'Einladungscode', en: 'Invitation Code' },
      text: {
        de: 'Neue Spieler registrieren sich selbst mit dem Clan-Code MAFIA2026. Du musst keine Accounts erstellen — einfach den Code weitergeben.',
        en: 'New players register themselves using the clan code MAFIA2026. You don\'t need to create accounts — just share the code.',
      },
    },
    {
      icon: '📋',
      title: { de: 'Audit-Log & Transparenz', en: 'Audit Log & Transparency' },
      text: {
        de: 'Alle Änderungen werden revisionssicher protokolliert. Wer hat wann was geändert — Streitfälle lassen sich jederzeit klären. 💪',
        en: 'All changes are logged in a tamper-proof audit trail. Who changed what and when — disputes can always be resolved. 💪',
      },
    },
  ],
}

const roleLabels: Record<Role, { de: string; en: string }> = {
  mitglied: { de: 'Mitglied', en: 'Member' },
  offizier: { de: 'Offizier', en: 'Officer' },
  admin: { de: 'Admin', en: 'Admin' },
}

interface WelcomeModalProps {
  role: Role
  isOpen: boolean
  onClose: () => void
}

export default function WelcomeModal({ role, isOpen, onClose }: WelcomeModalProps) {
  const [lang, setLang] = useState<Lang>('de')
  const [step, setStep] = useState(0)
  const currentSteps = steps[role]
  const current = currentSteps[step]

  useEffect(() => {
    if (isOpen) setStep(0)
  }, [isOpen, role])

  if (!isOpen) return null

  const handleClose = () => {
    try {
      localStorage.setItem(`clanbank_welcome_seen_v2_${role}`, 'true')
    } catch {}
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#161822] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-[#0f1117]/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <div className="font-bold text-white text-sm">1Ca – BANK</div>
              <div className="text-teal-400 text-xs">
                {lang === 'de'
                  ? `Anleitung · ${roleLabels[role].de}`
                  : `Guide · ${roleLabels[role].en}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(l => l === 'de' ? 'en' : 'de')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors px-2 py-1 rounded border border-gray-600 hover:border-teal-600"
            >
              <Globe size={12} />
              {lang === 'de' ? 'EN' : 'DE'}
            </button>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-white transition-colors p-1 ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-5 px-6">
          {currentSteps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-teal-400 w-6'
                  : i < step
                  ? 'bg-teal-700 w-2'
                  : 'bg-gray-600 hover:bg-gray-500 w-2'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[200px] flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-white font-bold text-lg mb-3">
            {current.title[lang]}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
            {current.text[lang]}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            {lang === 'de' ? 'Zurück' : 'Back'}
          </button>

          <span className="text-xs text-gray-600">
            {step + 1} / {currentSteps.length}
          </span>

          {step < currentSteps.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300 transition-colors font-medium"
            >
              {lang === 'de' ? 'Weiter' : 'Next'}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="text-sm bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
              {lang === 'de' ? "Los geht's! 🎯" : "Let's go! 🎯"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
