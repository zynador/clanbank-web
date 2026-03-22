import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.TEST_ADMIN_USER || 'testadmin'
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'testpass123'
const MEMBER_USER = process.env.TEST_MEMBER_USER || 'testmember'
const MEMBER_PASS = process.env.TEST_MEMBER_PASS || 'testpass123'

async function dismissModal(page: any) {
  const closeBtn = page.locator('button[aria-label="Schließen"]')
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click()
  }
}

test.describe('Login', () => {
  test('Login-Seite lädt korrekt', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/login/)
    await expect(page.getByPlaceholder(/benutzername/i)).toBeVisible()
    await expect(page.getByPlaceholder(/passwort/i)).toBeVisible()
  })

  test('Falsches Passwort zeigt Fehlermeldung', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/benutzername/i).fill('falschernutzer')
    await page.getByPlaceholder(/passwort/i).fill('falschespasswort')
    await page.getByRole('button', { name: /anmelden/i }).click()
    await expect(page.locator('.bg-red-900\\/30')).toBeVisible({ timeout: 8000 })
  })

  test('Admin kann sich einloggen', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/benutzername/i).fill(ADMIN_USER)
    await page.getByPlaceholder(/passwort/i).fill(ADMIN_PASS)
    await page.getByRole('button', { name: /anmelden/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
    await dismissModal(page)
  })

  test('Mitglied kann sich einloggen', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/benutzername/i).fill(MEMBER_USER)
    await page.getByPlaceholder(/passwort/i).fill(MEMBER_PASS)
    await page.getByRole('button', { name: /anmelden/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
    await dismissModal(page)
  })

  test('Nicht eingeloggt → Redirect zu Login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
