import { describe, expect, it } from 'vitest'
import { formatEventDate, formatEventTime } from './dates'

describe('formatEventDate', () => {
  it('formats in the style guide shape', () => {
    expect(formatEventDate('2027-02-13T13:30:00Z')).toBe('Sat, 13 Feb 2027')
  })

  it('uses Asia/Colombo, not UTC', () => {
    // 20:00 UTC on the 12th is 01:30 on the 13th in Colombo (UTC+5:30).
    expect(formatEventDate('2027-02-12T20:00:00Z')).toBe('Sat, 13 Feb 2027')
  })

  it('rejects invalid dates', () => {
    expect(() => formatEventDate('not a date')).toThrow(RangeError)
  })
})

describe('formatEventTime', () => {
  it('formats as lower-case 12-hour time in Colombo', () => {
    expect(formatEventTime('2027-02-13T13:30:00Z')).toBe('7:00 pm')
  })
})

describe('colomboInstant', () => {
  it('applies the fixed +05:30 offset', async () => {
    const { colomboInstant } = await import('./dates')
    expect(colomboInstant('2027-02-13', '19:00')).toBe('2027-02-13T13:30:00.000Z')
    expect(colomboInstant('2027-02-13', '19:00:00')).toBe('2027-02-13T13:30:00.000Z')
  })
  it('rejects garbage', async () => {
    const { colomboInstant } = await import('./dates')
    expect(() => colomboInstant('2027-13-45', '25:00')).toThrow(RangeError)
  })
})
