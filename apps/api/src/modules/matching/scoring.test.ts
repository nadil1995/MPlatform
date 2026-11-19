import { describe, expect, it } from 'vitest'
import {
  isEligible,
  MAX_MATCHES,
  rankCandidates,
  scoreCandidate,
  WEIGHTS,
  type MatchCandidate,
  type MatchEnquiry,
} from './scoring'

const enquiry: MatchEnquiry = {
  musicStyles: ['liveBand'],
  district: 'colombo',
  languages: ['si', 'en'],
  budgetMinCents: 5_000_000,
  budgetMaxCents: 15_000_000,
}

const perfect: MatchCandidate = {
  profileId: 'p',
  type: 'weddingBand',
  districts: ['colombo', 'gampaha'],
  priceFromCents: 8_000_000,
  ratingAvg: 5,
  ratingCount: 40,
  avgReplySeconds: 1800,
  verified: true,
  hasBio: true,
  serviceCount: 3,
  songsInLanguages: 25,
  bookedThatDay: false,
}

describe('WEIGHTS', () => {
  it('add up to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('isEligible', () => {
  it('accepts a musician who fits', () => {
    expect(isEligible(enquiry, perfect)).toBe(true)
  })
  it('rejects the wrong kind of act', () => {
    expect(isEligible(enquiry, { ...perfect, type: 'djMc' })).toBe(false)
  })
  it('accepts any of several requested styles', () => {
    expect(isEligible({ ...enquiry, musicStyles: ['dj', 'choir'] }, { ...perfect, type: 'djMc' })).toBe(true)
  })
  it('rejects musicians who do not play in the district', () => {
    expect(isEligible(enquiry, { ...perfect, districts: ['jaffna'] })).toBe(false)
  })
  it('rejects a starting price over budget', () => {
    expect(isEligible(enquiry, { ...perfect, priceFromCents: 15_000_001 })).toBe(false)
  })
  it('has no ceiling for the open-ended budget band', () => {
    expect(isEligible({ ...enquiry, budgetMaxCents: null }, { ...perfect, priceFromCents: 99_000_000 })).toBe(
      true,
    )
  })
  it('rejects musicians already booked that day', () => {
    expect(isEligible(enquiry, { ...perfect, bookedThatDay: true })).toBe(false)
  })
})

describe('scoreCandidate', () => {
  it('gives full marks to an ideal musician', () => {
    expect(scoreCandidate(enquiry, perfect)).toBe(100)
  })

  it('gives zero to an empty profile with the slowest replies and an under-budget price', () => {
    const empty: MatchCandidate = {
      ...perfect,
      priceFromCents: 1_000_000,
      ratingAvg: 0,
      ratingCount: 0,
      avgReplySeconds: 48 * 3600,
      verified: false,
      hasBio: false,
      serviceCount: 0,
      songsInLanguages: 0,
    }
    // Only the 0.7 under-budget price fit remains: 0.7 × 15 = 10.5 → 11.
    expect(scoreCandidate(enquiry, empty)).toBe(11)
  })

  it('discounts ratings with few reviews', () => {
    const few = scoreCandidate(enquiry, { ...perfect, ratingCount: 1 })
    expect(few).toBeLessThan(scoreCandidate(enquiry, perfect))
  })

  it('gives new musicians half the reply-speed marks', () => {
    const diff =
      scoreCandidate(enquiry, perfect) - scoreCandidate(enquiry, { ...perfect, avgReplySeconds: null })
    expect(diff).toBe(WEIGHTS.replySpeed / 2)
  })

  it('scales reply speed linearly between 1 h and 24 h', () => {
    const mid = scoreCandidate(enquiry, { ...perfect, avgReplySeconds: 3600 + 23 * 1800 })
    expect(mid).toBe(100 - WEIGHTS.replySpeed / 2)
  })

  it('scores profile completeness in parts', () => {
    expect(scoreCandidate(enquiry, { ...perfect, verified: false })).toBe(95)
    expect(scoreCandidate(enquiry, { ...perfect, hasBio: false, serviceCount: 0 })).toBe(95)
  })
})

describe('rankCandidates', () => {
  it('drops ineligible musicians and sorts best first', () => {
    const ranked = rankCandidates(enquiry, [
      { ...perfect, profileId: 'slow', avgReplySeconds: 30 * 3600 },
      { ...perfect, profileId: 'far', districts: ['jaffna'] },
      { ...perfect, profileId: 'best' },
    ])
    expect(ranked.map((r) => r.profileId)).toEqual(['best', 'slow'])
  })

  it(`caps the list at ${MAX_MATCHES}`, () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...perfect, profileId: String(i) }))
    expect(rankCandidates(enquiry, many)).toHaveLength(MAX_MATCHES)
  })

  it('returns an empty list when nobody fits', () => {
    expect(rankCandidates(enquiry, [])).toEqual([])
  })
})
