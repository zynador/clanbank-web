import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.TEST_ADMIN_USER || 'testadmin'
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'testpass123'
const MEMBER_USER = process.env.TEST_MEMBER_USER || 'testmember'
const MEMBER_PASS = process.env.TEST_MEMBER_PASS || 'testpass123'

test.describe('Login', () => {

  test('Login-Seite lädt korrekt', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/login/)
    await expect(page.getByPlaceholder(/username|benutzername/i)).toBeVisible()
    await expect(page.getByPlaceholder(/passwort|password/i)).toBeVisible()
  })

  test('Falsches Passwort zeigt Fehlermeldung', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/username|benutzername/i).fill('falschernutzer')
    await page.getByPlaceholder(/passwort|password/i).fill('falschespasswort')
    await page.getByRole('button', { name: /login|anmelden/i }).click()
    await expect(page.locator('text=/fehler|error|ungültig|invalid/i')).toBeVisible({ timeout: 5000 })
  })

  test('Admin kann sich einloggen', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/username|benutzername/i).fill(ADMIN_USER)
    await page.getByPlaceholder(/passwort|password/i).fill(ADMIN_PASS)
    await page.getByRole('button', { name: /login|anmelden/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('Mitglied kann sich einloggen', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/username|benutzername/i).fill(MEMBER_USER)
    await page.getByPlaceholder(/passwort|password/i).fill(MEMBER_PASS)
    await page.getByRole('button', { name: /login|anmelden/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('Nicht eingeloggt → Redirect zu Login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })

})
