import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition, TRANSITIONS } from './state'

describe('state machines', () => {
  it('allows the happy paths', () => {
    expect(canTransition('enquiry', 'open', 'quoted')).toBe(true)
    expect(canTransition('enquiry', 'quoted', 'booked')).toBe(true)
    expect(canTransition('quote', 'sent', 'accepted')).toBe(true)
    expect(canTransition('booking', 'pending_payment', 'confirmed')).toBe(true)
    expect(canTransition('booking', 'confirmed', 'completed')).toBe(true)
  })

  it('never leaves a terminal state', () => {
    for (const machine of ['enquiry', 'quote', 'booking'] as const) {
      for (const [from, next] of Object.entries(TRANSITIONS[machine])) {
        if (next.length === 0) {
          for (const to of Object.keys(TRANSITIONS[machine])) {
            expect(canTransition(machine, from as never, to as never)).toBe(false)
          }
        }
      }
    }
  })

  it('blocks skipping payment', () => {
    expect(canTransition('booking', 'pending_payment', 'completed')).toBe(false)
    expect(canTransition('enquiry', 'open', 'booked')).toBe(false)
  })

  it('rejects unknown states', () => {
    expect(canTransition('quote', 'nope' as never, 'sent')).toBe(false)
  })

  it('throws CONFLICT on an illegal change', () => {
    expect(() => assertTransition('quote', 'accepted', 'withdrawn')).toThrow('CONFLICT')
    expect(() => assertTransition('quote', 'sent', 'withdrawn')).not.toThrow()
  })
})
