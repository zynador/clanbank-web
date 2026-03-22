import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.TEST_ADMIN_USER || 'testadmin'
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'testpass123'
const MEMBER_USER = process.env.TEST_MEMBER_USER || 'testmember'
const MEMBER_PASS = process.env.TEST_MEMBER_PASS || 'testpass123'

async function loginAs(page: any, user: string, pass: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/benutzername/i).fill(user)
  await page.getByPlaceholder(/passwort/i).fill(pass)
  await page.getByRole('button', { name: /anmelden/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 10000 })
  const closeBtn = page.locator('button[aria-label="Schließen"]')
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click()
  }
}

async function navigateToFCU(page: any) {
  await page.locator('button[aria-label="Menü öffnen"]').click()
  await page.locator('text=FCU').click()
}

test.describe('FCU Event-Tracking', () => {
  test('FCU Tab lädt korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=🎯 FCU')).toBeVisible()
  })

  test('Admin sieht "Neues Event" Button', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/\\+ Neues Event/i')).toBeVisible()
  })

  test('Mitglied sieht KEINEN "Neues Event" Button', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/\\+ Neues Event/i')).not.toBeVisible()
  })

  test('Neues Event anlegen — Formular validiert Pflichtfelder', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Pflichtfeld|required/i')).toBeVisible()
  })

  test('Neues Event anlegen — Erfolg', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('input[type="text"]').fill('Test FCU ' + Date.now())
    await page.locator('input[type="date"]').fill('2026-03-20')
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Screenshot|Upload/i')).toBeVisible({ timeout: 5000 })
  })

  test('Upload Panel — Slot vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('input[type="text"]').fill('Test FCU ' + Date.now())
    await page.locator('input[type="date"]').fill('2026-03-20')
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Screenshot 1/i')).toBeVisible({ timeout: 5000 })
  })

  test('Gesamtranking öffnet sich', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking/i').click()
    await expect(page.locator('text=/Rang|Ranking/i')).toBeVisible()
  })

  test('Gesamtranking zurück zur Liste', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking/i').click()
    await page.locator('text=/← Zurück|Back/i').click()
    await expect(page.locator('text=/\\+ Neues Event/i')).toBeVisible()
  })
})
