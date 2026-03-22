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

test.describe('HomeTab', () => {
  test('HomeTab ist Standard nach Login', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=🏠 Home')).toBeVisible()
  })

  test('Begrüssungstext mit Spielernamen', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Willkommen|Welcome/i')).toBeVisible()
  })

  test('Persönlicher Status wird angezeigt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Clanbank/i')).toBeVisible()
  })

  test('Admin sieht Clanbank-Rückstand Block', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Wand der Schande|Rückstand/i')).toBeVisible()
  })

  test('Mitglied sieht KEINEN Clanbank-Rückstand Block', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await expect(page.locator('text=/Wand der Schande/i')).not.toBeVisible()
  })

  test('Schnellzugriff-Buttons vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/💰|Bank/i').first()).toBeVisible()
    await expect(page.locator('text=/🎯|FCU/i').first()).toBeVisible()
  })

  test('Schnellzugriff navigiert korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button:has-text("FCU")').first().click()
    await expect(page.locator('text=🎯 FCU')).toBeVisible()
  })
})
