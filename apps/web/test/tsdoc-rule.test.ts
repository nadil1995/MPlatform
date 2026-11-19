// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// P0-01 acceptance: "The ESLint jsdoc rule fails a function without TSDoc."
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const lint = async (code: string) => {
  const eslint = new ESLint({ cwd: repoRoot })
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}/apps/web/lib/__fixture__.ts` })
  return (result?.messages ?? []).map((m) => m.ruleId)
}

describe('TSDoc lint rule', () => {
  it('fails an undocumented function declaration', async () => {
    expect(await lint('export function add(a: number, b: number): number { return a + b }\n')).toContain(
      'jsdoc/require-jsdoc',
    )
  })

  it('fails an undocumented arrow function bound to a name', async () => {
    expect(await lint('export const add = (a: number, b: number): number => a + b\n')).toContain(
      'jsdoc/require-jsdoc',
    )
  })

  it('fails a doc block that skips a param', async () => {
    const code = '/**\n * Add.\n * @returns Sum.\n */\nexport function add(a: number): number { return a }\n'
    expect(await lint(code)).toContain('jsdoc/require-param')
  })

  it('passes a documented function and an inline callback', async () => {
    const code =
      '/**\n * Double each.\n * @param xs - Numbers.\n * @returns Doubled.\n */\nexport function double(xs: number[]): number[] {\n  return xs.map((x) => x * 2)\n}\n'
    expect(await lint(code)).toEqual([])
  })
})
