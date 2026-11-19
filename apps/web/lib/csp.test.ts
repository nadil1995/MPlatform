import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce } from './csp'

describe('buildCsp', () => {
  it('allows only nonce-tagged scripts in production', () => {
    const csp = buildCsp('abc', false)
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('relaxes only what next dev needs', () => {
    expect(buildCsp('abc', true)).toContain("'unsafe-eval'")
  })
})

describe('createNonce', () => {
  it('is different every time', () => {
    expect(createNonce()).not.toBe(createNonce())
  })

  it('has 128 bits of entropy', () => {
    expect(atob(createNonce())).toHaveLength(16)
  })
})
