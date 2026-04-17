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

test.describe('Navigation — Hamburger Drawer', () => {
  test('Drawer öffnet und schließt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.getByRole('button', { name: '🏠 Home' })).not.toBeVisible()
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.getByRole('button', { name: '🏠 Home' })).toBeVisible()
    await page.locator('.bg-black\\/60').click()
    await expect(page.getByRole('button', { name: '🏠 Home' })).not.toBeVisible()
  })

  test('Admin sieht alle Tabs', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.getByRole('button', { name: '🏠 Home' })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('button', { name: /Bank/i })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('button', { name: /Kampfberichte/i })).toBeVisible()
    await expect(page.getByRole('navigation').locator('text=/Admin|Verwaltung/i').first()).toBeVisible()
  })

  test('Mitglied sieht keine Admin-Tabs', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.getByRole('navigation').locator('text=/Admin|Verwaltung/i')).not.toBeVisible()
    await expect(page.getByRole('navigation').getByRole('button', { name: /Freigaben/i })).not.toBeVisible()
    await expect(page.getByRole('navigation').getByRole('button', { name: /Warnungen/i })).not.toBeVisible()
  })

  test('Tab-Navigation funktioniert', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await page.getByRole('navigation').getByRole('button', { name: /Ranking/i }).click()
    await expect(page.getByRole('button', { name: '🏠 Home' })).not.toBeVisible()
  })

  test('Abmelden funktioniert', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await page.locator('text=/Abmelden|Logout/i').click()
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
