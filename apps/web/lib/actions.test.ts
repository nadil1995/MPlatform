import { describe, expect, it, vi } from 'vitest'

// The action module imports server-only helpers; only the pure guard is under test.
vi.mock('./api', () => ({ api: {}, ApiError: Error }))
vi.mock('./session', () => ({}))
vi.mock('./env', () => ({ devSignInEnabled: () => true }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const { safeNext } = await import('./actions')

describe('safeNext (open-redirect guard)', () => {
  it.each(['/en/events', '/si/checkout/abc?x=1', '/ta'])('allows %s', async (p) => {
    expect(await safeNext(p, 'en')).toBe(p)
  })

  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    '/en//evil.com',
    '/fr/events',
    'javascript:alert(1)',
    42,
  ])('rejects %s', async (p) => {
    expect(await safeNext(p, 'si')).toBe('/si')
  })
})
