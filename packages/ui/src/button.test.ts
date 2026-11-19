import { describe, expect, it } from 'vitest'
import { buttonClasses } from './button'

describe('buttonClasses', () => {
  it('meets the 44px touch target at every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(buttonClasses('primary', size)).toMatch(/min-h-1[12]/)
    }
  })

  it('lets extra classes override the variant', () => {
    expect(buttonClasses('primary', 'md', 'bg-red-600')).not.toContain('bg-brand-600')
  })
})
