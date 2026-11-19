import { describe, expect, it } from 'vitest'
import { musicianSearchQuerySchema } from './search'

describe('musicianSearchQuerySchema', () => {
  it('normalises single and repeated params to arrays', () => {
    expect(musicianSearchQuerySchema.parse({ type: 'djs' }).type).toEqual(['djs'])
    expect(musicianSearchQuerySchema.parse({ lang: ['si', 'ta'] }).lang).toEqual(['si', 'ta'])
  })

  it('applies defaults for an empty query', () => {
    expect(musicianSearchQuerySchema.parse({})).toEqual({
      type: [],
      lang: [],
      sort: 'bestMatch',
      page: 1,
      pageSize: 24,
    })
  })

  it('falls back instead of throwing on tampered values', () => {
    const r = musicianSearchQuerySchema.parse({
      type: '<script>',
      district: 'atlantis',
      sort: 'price DESC; DROP TABLE',
      maxBudget: '999',
      verified: 'yes',
      pageSize: '5000',
    })
    expect(r).toEqual({ type: [], lang: [], sort: 'bestMatch', page: 1, pageSize: 24 })
  })

  it('accepts an allowed budget ceiling', () => {
    expect(musicianSearchQuerySchema.parse({ maxBudget: '150000' }).maxBudget).toBe(150_000)
  })

  it('turns verified=1 into true', () => {
    expect(musicianSearchQuerySchema.parse({ verified: '1' }).verified).toBe(true)
  })
})
