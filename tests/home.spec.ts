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

test.describe('HomeTab', () => {

  test('HomeTab ist Standard nach Login', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=🏠 Home')).toBeVisible()
  })

  test('Begrüssungstext mit Spielernamen', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Willkommen|Welcome/')).toBeVisible()
  })

  test('Persönlicher Status wird angezeigt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    // Entweder grüner oder roter Status
    const statusGreen = page.locator('text=/auf dem Laufenden|up to date/i')
    const statusRed = page.locator('text=/im Rückstand|behind/i')
    await expect(statusGreen.or(statusRed)).toBeVisible({ timeout: 8000 })
  })

  test('Admin sieht Clanbank-Rückstand Block', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/Clanbank-Rückstand|Clanbank backlog/i')).toBeVisible({ timeout: 8000 })
  })

  test('Mitglied sieht KEINEN Clanbank-Rückstand Block', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await expect(page.locator('text=/Clanbank-Rückstand|Clanbank backlog/i')).not.toBeVisible({ timeout: 5000 })
  })

  test('Schnellzugriff-Buttons vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=💰')).toBeVisible()
    await expect(page.locator('text=⚔️')).toBeVisible()
    await expect(page.locator('text=🏆')).toBeVisible()
    await expect(page.locator('text=🎯')).toBeVisible()
  })

  test('Schnellzugriff navigiert korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    // Klick auf FCU Schnellzugriff
    await page.locator('text=🎯').click()
    await expect(page.locator('text=🎯 FCU')).toBeVisible()
  })

})
