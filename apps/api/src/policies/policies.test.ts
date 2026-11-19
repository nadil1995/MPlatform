import { describe, expect, it } from 'vitest'
import { canQuote, canViewEnquiry } from '.'

const actor = { userId: 'u1', roles: ['client', 'musician'] as const, profileId: 'p1' }

describe('canViewEnquiry', () => {
  it('lets the owner see it', () => expect(canViewEnquiry(actor, { clientUserId: 'u1' })).toBe(true))
  it("hides someone else's", () => expect(canViewEnquiry(actor, { clientUserId: 'u2' })).toBe(false))
})

describe('canQuote', () => {
  it('requires a match for the actor’s own profile', () => {
    expect(canQuote(actor, { profileId: 'p1', declinedAt: null })).toBe(true)
    expect(canQuote(actor, { profileId: 'p2', declinedAt: null })).toBe(false)
    expect(canQuote(actor, undefined)).toBe(false)
  })
  it('blocks quoting after declining', () => {
    expect(canQuote(actor, { profileId: 'p1', declinedAt: new Date() })).toBe(false)
  })
})
