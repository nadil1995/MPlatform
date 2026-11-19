import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    let now = 0
    const rl = new RateLimiter(2, 1000, () => now)
    expect(rl.take('a')).toBe(true)
    expect(rl.take('a')).toBe(true)
    expect(rl.take('a')).toBe(false)
    expect(rl.take('b')).toBe(true)
    now = 1000
    expect(rl.take('a')).toBe(true)
  })
})
