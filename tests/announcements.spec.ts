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
    const title = 'TEST ' + Date.now()
    await page.locator('text=/\\+ Ankündigung erstellen/i').click()
    await page.locator('input[placeholder*="Titel"]').fill(title)
    await page.locator('text=/Veröffentlichen|Publish/i').click()
    await expect(page.locator('text=' + title)).toBeVisible({ timeout: 5000 })
    await page.locator('text=' + title).locator('..').locator('button:has-text("✕")').click()
    await expect(page.locator('text=' + title)).not.toBeVisible({ timeout: 5000 })
  })

  test('Angepinnte Ankündigung erscheint zuerst', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    const pinnedTitle = 'ANGEPINNT ' + Date.now()
    await page.locator('text=/\\+ Ankündigung erstellen/i').click()
    await page.locator('input[placeholder*="Titel"]').fill(pinnedTitle)
    await page.locator('input[type="checkbox"]').check()
    await page.locator('text=/Veröffentlichen|Publish/i').click()
    await expect(page.locator('text=' + pinnedTitle)).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=📌').first()).toBeVisible()
  })
})
