import { describe, expect, it } from 'vitest'
import { calculateDepositCents, formatLKR } from './money'

describe('calculateDepositCents', () => {
  it('takes 30% of the quote total', () => {
    expect(calculateDepositCents(12_000_000)).toBe(3_600_000)
  })

  it('rounds to a whole rupee so the balance is whole too', () => {
    // LKR 33,333 × 30% = 9,999.9 → 10,000
    expect(calculateDepositCents(3_333_300)).toBe(1_000_000)
    expect(calculateDepositCents(3_333_300) % 100).toBe(0)
  })

  it('returns 0 for a zero total', () => {
    expect(calculateDepositCents(0)).toBe(0)
  })

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])('rejects %s', (bad) => {
    expect(() => calculateDepositCents(bad)).toThrow(RangeError)
  })
})

describe('formatLKR', () => {
  it('formats with grouping and no decimals', () => {
    expect(formatLKR(12_000_000)).toBe('LKR 120,000')
  })

  it('rounds partial rupees for display', () => {
    expect(formatLKR(4_550)).toBe('LKR 46')
  })

  it('rejects negative amounts', () => {
    expect(() => formatLKR(-100)).toThrow(RangeError)
  })
})
