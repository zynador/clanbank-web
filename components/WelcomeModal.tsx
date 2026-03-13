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
        en:
