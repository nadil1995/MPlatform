import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import si from '../i18n/si.json'
import ta from '../i18n/ta.json'

/** Flatten nested message objects into dotted keys. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('translations', () => {
  const enKeys = keys(en).sort()

  it.each([
    ['si', si],
    ['ta', ta],
  ])('%s has exactly the English keys', (_name, messages) => {
    expect(keys(messages).sort()).toEqual(enKeys)
  })
})
