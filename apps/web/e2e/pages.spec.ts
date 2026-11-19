import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Sign in through the dev sign-in page as a seeded user.
 *
 * @param page - Playwright page.
 * @param name - Display name of the seeded account.
 * @param next - Optional page to land on afterwards.
 */
async function signInAs(page: Page, name: string, next?: string) {
  await page.goto(`/en/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  await page.getByRole('button', { name: `Continue as ${name}` }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'))
}

/**
 * From "My events", open the event that has received quotes and wait for the page.
 *
 * @param page - Playwright page on /en/events.
 */
async function openQuotedEvent(page: Page) {
  await page.locator('li', { hasText: 'Quotes received' }).getByRole('link', { name: 'View quotes' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\/quotes/)
}

/**
 * Assert no WCAG 2.2 AA violations on the current page.
 *
 * @param page - Playwright page.
 */
async function expectAccessible(page: Page) {
  await expect(page.locator('main')).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('public pages are accessible and show data from the API', async ({ page }) => {
  await page.goto('/en')
  await expectAccessible(page)
  await expect(page.getByRole('heading', { name: /Popular in Colombo/ })).toBeVisible()

  await page.goto('/en/musicians?type=weddingBands')
  await expectAccessible(page)
  await expect(page.getByText(/\d+ musicians · showing those free/)).toBeVisible()

  await page.goto('/en/musicians?type=choirs&district=jaffna')
  await expect(page.getByRole('heading', { name: 'No one matches all your filters' })).toBeVisible()

  await page.goto('/en/musicians/rhythm-junction?tab=reviews')
  await expectAccessible(page)
  await expect(page.getByText(/Verified booking/).first()).toBeVisible()

  await page.goto('/si')
  await expectAccessible(page)
})

test('private pages send signed-out visitors to sign-in and back', async ({ page }) => {
  await page.goto('/en/events')
  await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fevents/)
  await page.getByRole('button', { name: 'Continue as Dilani Perera' }).click()
  await expect(page).toHaveURL(/\/en\/events$/)
})

test('client compares quotes and reaches a server-priced checkout', async ({ page }) => {
  await signInAs(page, 'Dilani Perera', '/en/events')
  await expectAccessible(page)
  await openQuotedEvent(page)
  await expectAccessible(page)
  await expect(page.getByRole('heading', { name: /3 quotes/ })).toBeVisible()

  // Book the cheapest quote and check the deposit is exactly 30% of its total.
  await page.getByRole('link', { name: 'Price' }).click()
  await page
    .getByRole('link', { name: /^Book / })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  await expectAccessible(page)
  const total = Number((await page.locator('dt:has-text("Quote total") + dd').innerText()).replace(/\D/g, ''))
  const deposit = Number(
    (await page.locator('dt:has-text("Deposit today") + dd').innerText()).replace(/\D/g, ''),
  )
  expect(deposit).toBe(Math.round(total * 0.3))
  await expect(page.getByRole('button', { name: /^Pay LKR/ })).toBeDisabled()
})

test('client posts an event and musicians are matched', async ({ page }) => {
  await signInAs(page, 'Ravi Kumar', '/en/events/new')
  await expectAccessible(page)
  const date = new Date(Date.now() + 75 * 86_400_000).toISOString().slice(0, 10)
  await page.getByText('Wedding', { exact: true }).click()
  await page.getByLabel('Date').fill(date)
  await page.getByLabel('Start time').fill('19:00')
  await page.getByLabel('District').selectOption('colombo')
  await page.getByLabel('Guests').selectOption('150to250')
  await page.getByText('Live band', { exact: true }).click()
  await page.getByText('Sinhala', { exact: true }).click()
  await page.getByText('Not sure', { exact: true }).click()
  await page.getByText('LKR 50,000 – 150,000', { exact: true }).click()
  await page.getByRole('button', { name: 'Send to matching musicians' }).click()

  await expect(page.getByRole('heading', { name: 'Your event is posted' })).toBeVisible()
  await expect(page.getByText(/We alerted \d+ musicians? who/)).toBeVisible()
  await page.getByRole('link', { name: 'See my quotes' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting for quotes' })).toBeVisible()
})

test('musician sees matched enquiries and can decline one', async ({ page }) => {
  await signInAs(page, 'Rhythm Junction (owner)', '/en/musician/dashboard')
  await expectAccessible(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Rhythm Junction' })).toBeVisible()
  const cards = page.locator('section:has(h2:text("New enquiries")) li')
  const before = await cards.count()
  expect(before).toBeGreaterThan(0)
  await cards.first().getByRole('button', { name: 'Not available' }).click()
  await expect(cards).toHaveCount(before - 1)
})

test('a client cannot open someone else’s quotes (IDOR)', async ({ page }) => {
  await signInAs(page, 'Dilani Perera', '/en/events')
  await openQuotedEvent(page)
  const url = page.url()
  await page.context().clearCookies()
  await signInAs(page, 'Shenali Fernando')
  await page.goto(url)
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})

test('language switcher keeps the current page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The switcher is in the desktop header; mobile gets it with the menu in a later task.')
  await page.goto('/en/musicians/rhythm-junction?tab=reviews')
  await page.getByRole('link', { name: 'සිං' }).click()
  await expect(page).toHaveURL(/\/si\/musicians\/rhythm-junction\?tab=reviews/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'si')
})

test('every page sends a nonce CSP', async ({ request }) => {
  const res = await request.get('/en')
  expect(res.headers()['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
})
