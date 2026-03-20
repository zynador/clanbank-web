import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.TEST_ADMIN_USER || 'testadmin'
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'testpass123'
const MEMBER_USER = process.env.TEST_MEMBER_USER || 'testmember'
const MEMBER_PASS = process.env.TEST_MEMBER_PASS || 'testpass123'

async function loginAs(page: any, user: string, pass: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/username|benutzername/i).fill(user)
  await page.getByPlaceholder(/passwort|password/i).fill(pass)
  await page.getByRole('button', { name: /login|anmelden/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 10000 })
}

async function navigateToFCU(page: any) {
  await page.locator('button[aria-label="Menü öffnen"]').click()
  await page.locator('text=FCU').click()
}

test.describe('FCU Event-Tracking', () => {

  test('FCU Tab lädt korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/FCU Events/')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/Gesamtranking|Overall Ranking/')).toBeVisible()
  })

  test('Admin sieht "Neues Event" Button', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/Neues Event|New Event/')).toBeVisible()
  })

  test('Mitglied sieht KEINEN "Neues Event" Button', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/Neues Event|New Event/')).not.toBeVisible()
  })

  test('Neues Event anlegen — Formular validiert Pflichtfelder', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event|\\+ New Event/').click()
    // Ohne Ausfüllen speichern
    await page.locator('text=/Anlegen|Create/').click()
    await expect(page.locator('text=/Pflichtfeld|required/i')).toBeVisible()
  })

  test('Neues Event anlegen — Erfolg', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event|\\+ New Event/').click()
    await page.locator('input[type="text"]').fill('Test FCU ' + Date.now())
    await page.locator('input[type="date"]').fill('2026-03-20')
    await page.locator('text=/Anlegen|Create/').click()
    // Weiterleitung zu Upload
    await expect(page.locator('text=/Screenshots hochladen|Upload Screenshots/')).toBeVisible({ timeout: 8000 })
  })

  test('Upload Panel — Slot vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    // Erstes Draft-Event öffnen
    const uploadBtn = page.locator('button:has-text("📷")').first()
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click()
      await expect(page.locator('text=/Screenshot 1/')).toBeVisible()
      await expect(page.locator('text=/\\+ Weiterer Screenshot|\\+ Add Screenshot/')).toBeVisible()
    }
  })

  test('Gesamtranking öffnet sich', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking|Overall Ranking/').click()
    await expect(page.locator('text=/FCU Gesamtranking|FCU Overall Ranking/')).toBeVisible()
    await expect(page.locator('text=/← Zurück|← Back/')).toBeVisible()
  })

  test('Gesamtranking zurück zur Liste', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking|Overall Ranking/').click()
    await page.locator('text=/← Zurück|← Back/').click()
    await expect(page.locator('text=/FCU Events/')).toBeVisible()
  })

})
