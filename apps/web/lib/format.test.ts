import { describe, expect, it } from 'vitest'
import { initials } from './format'

describe('initials', () => {
  it('takes the first two words', () => expect(initials('Rhythm Junction Band')).toBe('RJ'))
  it('skips punctuation-led words', () => expect(initials('St. Cecilia Singers')).toBe('SC'))
  it('handles one word', () => expect(initials('Kalana')).toBe('K'))
})
