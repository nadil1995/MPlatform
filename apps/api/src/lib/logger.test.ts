import { Writable } from 'node:stream'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import { REDACT_PATHS } from './logger'

describe('log redaction', () => {
  it('removes PII and secrets', () => {
    const lines: string[] = []
    const sink = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk))
        cb()
      },
    })
    const log = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, sink)
    log.info({
      user: { phone: '+94771234567', email: 'a@b.lk', displayName: 'Dilani' },
      enquiry: { notes: 'call me on 0771234567', venue: 'Cinnamon Grand' },
      req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
    })
    const out = lines.join('')
    for (const leaked of [
      '+94771234567',
      'a@b.lk',
      'Dilani',
      '0771234567',
      'Cinnamon',
      'Bearer abc',
      'sid=1',
    ]) {
      expect(out).not.toContain(leaked)
    }
  })
})
