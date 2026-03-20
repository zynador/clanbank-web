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

test.describe('Navigation — Hamburger Drawer', () => {

  test('Drawer öffnet und schließt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    // Drawer initial geschlossen
    await expect(page.locator('text=Home')).not.toBeVisible()
    // Hamburger klicken
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.locator('text=Home')).toBeVisible()
    // Backdrop klicken schließt Drawer
    await page.locator('.bg-black\\/50').click()
    await expect(page.locator('text=Home')).not.toBeVisible()
  })

  test('Admin sieht alle Tabs', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.locator('text=Home')).toBeVisible()
    await expect(page.locator('text=Bank')).toBeVisible()
    await expect(page.locator('text=Kampfberichte')).toBeVisible()
    await expect(page.locator('text=Ranking')).toBeVisible()
    await expect(page.locator('text=FCU')).toBeVisible()
    await expect(page.locator('text=Freigaben')).toBeVisible()
    await expect(page.locator('text=Warnungen')).toBeVisible()
    await expect(page.locator('text=Admin')).toBeVisible()
  })

  test('Mitglied sieht keine Admin-Tabs', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await expect(page.locator('text=Home')).toBeVisible()
    await expect(page.locator('text=FCU')).toBeVisible()
    await expect(page.locator('text=Admin')).not.toBeVisible()
    await expect(page.locator('text=Freigaben')).not.toBeVisible()
    await expect(page.locator('text=Warnungen')).not.toBeVisible()
  })

  test('Tab-Navigation funktioniert', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await page.locator('text=Ranking').click()
    // Drawer schließt sich nach Klick
    await expect(page.locator('text=Home')).not.toBeVisible()
    // Breadcrumb zeigt aktiven Tab
    await expect(page.locator('text=🏆 Ranking')).toBeVisible()
  })

  test('Abmelden funktioniert', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('button[aria-label="Menü öffnen"]').click()
    await page.locator('text=Abmelden').click()
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })

})
