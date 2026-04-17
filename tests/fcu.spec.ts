import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.TEST_ADMIN_USER || 'testadmin'
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'testpass123'
const MEMBER_USER = process.env.TEST_MEMBER_USER || 'testmember'
const MEMBER_PASS = process.env.TEST_MEMBER_PASS || 'testpass123'
const SUPABASE_URL = 'https://izerwxvxpcljpkltmblf.supabase.co'

async function loginAs(page: any, user: string, pass: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/benutzername/i).fill(user)
  await page.getByPlaceholder(/passwort/i).fill(pass)
  await page.getByRole('button', { name: /anmelden/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 10000 })
  try {
    await page.locator('button[aria-label="Schlie\u00dfen"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('button[aria-label="Schlie\u00dfen"]').click()
    await page.locator('div.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5000 })
  } catch {
    // Modal nicht erschienen
  }
}

async function navigateToFCU(page: any) {
  await page.locator('button[aria-label="Men\u00fc \u00f6ffnen"]').click()
  await page.getByRole('navigation').getByRole('button', { name: /FCU/i }).click()
}

test.describe('FCU Event-Tracking', () => {
  test.afterAll(async ({ request }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return
    const headers = {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
    }
    const res = await request.get(
      SUPABASE_URL + '/rest/v1/fcu_events?event_name=like.Test+FCU%25&select=id',
      { headers }
    )
    const events: { id: string }[] = await res.json()
    for (const ev of events) {
      await request.delete(
        SUPABASE_URL + '/rest/v1/fcu_results?fcu_event_id=eq.' + ev.id,
        { headers }
      )
      await request.delete(
        SUPABASE_URL + '/rest/v1/fcu_events?id=eq.' + ev.id,
        { headers }
      )
    }
  })

  test('FCU Tab l\u00e4dt korrekt', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=\uD83C\uDFAF FCU')).toBeVisible()
  })

  test('Admin sieht "Neues Event" Button', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/\\+ Neues Event/i')).toBeVisible()
  })

  test('Mitglied sieht KEINEN "Neues Event" Button', async ({ page }) => {
    await loginAs(page, MEMBER_USER, MEMBER_PASS)
    await navigateToFCU(page)
    await expect(page.locator('text=/\\+ Neues Event/i')).not.toBeVisible()
  })

  test('Neues Event anlegen \u2014 Formular validiert Pflichtfelder', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Pflichtfeld|required/i')).toBeVisible()
  })

  test('Neues Event anlegen \u2014 Erfolg', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('input[type="text"]').fill('Test FCU ' + Date.now())
    await page.locator('input[type="date"]').fill('2026-03-20')
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Screenshot 1/i')).toBeVisible({ timeout: 5000 })
  })

  test('Upload Panel \u2014 Slot vorhanden', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/\\+ Neues Event/i').click()
    await page.locator('input[type="text"]').fill('Test FCU ' + Date.now())
    await page.locator('input[type="date"]').fill('2026-03-20')
    await page.locator('text=/Anlegen|Create/i').click()
    await expect(page.locator('text=/Screenshot 1/i')).toBeVisible({ timeout: 5000 })
  })

  test('Gesamtranking \u00f6ffnet sich', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking/i').click()
    await expect(page.locator('text=/Rang|Ranking/i').first()).toBeVisible()
  })

  test('Gesamtranking zur\u00fcck zur Liste', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS)
    await navigateToFCU(page)
    await page.locator('text=/Gesamtranking/i').click()
    await page.locator('text=/\u2190 Zur\u00fcck|Back/i').click()
    await expect(page.locator('text=/\\+ Neues Event/i')).toBeVisible()
  })
})
