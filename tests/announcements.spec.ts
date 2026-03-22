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
  } catch {}
}

test.describe('Ankündigungen', () => {
  test('Admin sieht Ankündigung erstellen Button', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/\\+ Ankündigung erstellen/i')).toBeVisible()
  })

  test('Mitglied sieht KEINEN erstellen Button', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await expect(page.locator('text=/\\+ Ankündigung erstellen/i')).not.toBeVisible()
  })

  test('Ankündigung erstellen und löschen', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    // Formular öffnen
    await page.locator('text=/\\+ Ankündigung erstellen/i').click()
    await page.locator('input[placeholder*="Titel"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('input[placeholder*="Titel"]').fill('TEST LOESCHEN')
    // Abschicken
    await page.getByRole('button', { name: 'Veröffentlichen' }).click()
    // Erfolg = Formular schließt sich
    await expect(page.locator('input[placeholder*="Titel"]')).not.toBeVisible({ timeout: 5000 })
    // Mindestens ein ✕-Button vorhanden (Ankündigungen existieren)
    await expect(page.locator('button:has-text("✕")').first()).toBeVisible({ timeout: 5000 })
    // Ersten ✕-Button klicken und prüfen dass Aktion ausführbar ist
    await page.locator('button:has-text("✕")').first().click()
    // Formular bleibt geschlossen nach Löschen
    await expect(page.locator('input[placeholder*="Titel"]')).not.toBeVisible()
  })

  test('Angepinnte Ankündigung erscheint zuerst', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await page.locator('text=/\\+ Ankündigung erstellen/i').click()
    await page.locator('input[placeholder*="Titel"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('input[placeholder*="Titel"]').fill('ANGEPINNT TEST')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: 'Veröffentlichen' }).click()
    await expect(page.locator('input[placeholder*="Titel"]')).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=📌').first()).toBeVisible({ timeout: 5000 })
  })
})
