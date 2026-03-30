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
  try {
    await page.locator('button[aria-label="Schließen"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('button[aria-label="Schließen"]').click()
    await page.locator('div.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5000 })
  } catch {
    // Modal nicht erschienen
  }
}

test.describe('HomeTab', () => {
  test('HomeTab ist Standard nach Login', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=🏠 Home')).toBeVisible()
  })

  test('Begrüssungstext mit Spielernamen', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Willkommen|Welcome/i').first()).toBeVisible()
  })

  test('Persönlicher Status wird angezeigt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Clanbank/i').first()).toBeVisible()
  })

  test('Admin sieht Clanbank-Status Block', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=⚠️ Clanbank-Status')).toBeVisible()
  })

  test('Mitglied sieht Clanbank-Status Block', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await expect(page.locator('text=⚠️ Clanbank-Status')).toBeVisible()
  })

  test('Schnellzugriff-Buttons vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/💰|Bank/').first()).toBeVisible()
    await expect(page.locator('text=/🎯|FCU/').first()).toBeVisible()
  })

  test('Schnellzugriff navigiert korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button:has-text("FCU")').first().click()
    await expect(page.locator('text=🎯 FCU')).toBeVisible()
  })
})
