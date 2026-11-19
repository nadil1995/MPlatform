import { describe, expect, it } from 'vitest'
import { enquiryDraftSchema } from './enquiry'

const valid = {
  occasion: 'wedding',
  eventDate: '2027-02-13',
  startTime: '19:00',
  district: 'colombo',
  guests: '150to250',
  musicStyles: ['liveBand'],
  songLanguages: ['si', 'en'],
  venueHasSound: 'no',
  budget: '50kTo150k',
}

describe('enquiryDraftSchema', () => {
  it('accepts a complete enquiry', () => {
    expect(enquiryDraftSchema.safeParse(valid).success).toBe(true)
  })

  it('returns i18n keys, not English, as error messages', () => {
    const r = enquiryDraftSchema.safeParse({ ...valid, musicStyles: [] })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('styleRequired')
  })

  it('rejects districts outside the fixed list', () => {
    expect(enquiryDraftSchema.safeParse({ ...valid, district: 'atlantis' }).success).toBe(false)
  })

  it('rejects notes over the limit', () => {
    const r = enquiryDraftSchema.safeParse({ ...valid, notes: 'x'.repeat(1001) })
    expect(r.error?.issues[0]?.message).toBe('notesTooLong')
  })

  it('rejects a malformed date', () => {
    expect(enquiryDraftSchema.safeParse({ ...valid, eventDate: '13/02/2027' }).success).toBe(false)
  })

  it('drops unknown keys so clients cannot smuggle fields (e.g. a price)', () => {
    const r = enquiryDraftSchema.parse({ ...valid, priceCents: 1 })
    expect(r).not.toHaveProperty('priceCents')
  })
})
