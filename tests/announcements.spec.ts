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

test.describe('Ankündigungen', () => {

  test('Admin sieht Ankündigung erstellen Button', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await expect(page.locator('text=/\\+ Ankündigung|\\+ Announcement/')).toBeVisible({ timeout: 8000 })
  })

  test('Mitglied sieht KEINEN erstellen Button', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await expect(page.locator('text=/\\+ Ankündigung|\\+ Announcement/')).not.toBeVisible({ timeout: 5000 })
  })

  test('Ankündigung erstellen und löschen', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    const title = 'Test Ankuendigung ' + Date.now()

    // Erstellen
    await page.locator('text=/\\+ Ankündigung|\\+ Announcement/').click()
    await page.locator('input[placeholder*="Titel"]').fill(title)
    await page.locator('text=/Veröffentlichen|Publish/').click()

    // Sichtbar
    await expect(page.locator('text=' + title)).toBeVisible({ timeout: 5000 })

    // Löschen
    await page.locator('text=' + title).locator('..').locator('button:has-text("✕")').click()
    await expect(page.locator('text=' + title)).not.toBeVisible({ timeout: 5000 })
  })

  test('Angepinnte Ankündigung erscheint zuerst', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    const pinnedTitle = 'ANGEPINNT ' + Date.now()

    await page.locator('text=/\\+ Ankündigung|\\+ Announcement/').click()
    await page.locator('input[placeholder*="Titel"]').fill(pinnedTitle)
    await page.locator('input[type="checkbox"]').check()
    await page.locator('text=/Veröffentlichen|Publish/').click()

    await expect(page.locator('text=📌')).toBeVisible({ timeout: 5000 })

    // Aufräumen
    await page.locator('text=' + pinnedTitle).locator('..').locator('button:has-text("✕")').click()
  })

})
