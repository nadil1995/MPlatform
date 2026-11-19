import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  DEV_JWT_SECRET: 'x'.repeat(32),
  AUDIT_IP_SALT: 'y'.repeat(16),
}

describe('loadConfig', () => {
  it('accepts a valid local config and applies defaults', () => {
    const c = loadConfig(base)
    expect(c.PORT).toBe(8080)
    expect(c.AUTH_MODE).toBe('dev')
    expect(c.CORS_ORIGINS).toEqual(['http://localhost:3000'])
  })

  it('refuses dev auth in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/AUTH_MODE=dev is not allowed/)
  })

  it('requires a long dev secret in dev mode', () => {
    expect(() => loadConfig({ ...base, DEV_JWT_SECRET: 'short' })).toThrow(/DEV_JWT_SECRET/)
  })

  it('never echoes secret values in the error', () => {
    try {
      loadConfig({ ...base, DATABASE_URL: 'mysql://user:hunter2@db' })
    } catch (e) {
      expect(String(e)).not.toContain('hunter2')
    }
  })

  it('rejects a wildcard CORS origin', () => {
    expect(() => loadConfig({ ...base, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/)
  })
})
