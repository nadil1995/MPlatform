// @ts-check
/**
 * Shared ESLint flat config for the whole monorepo.
 *
 * The TSDoc rules below are a non-negotiable rule from CLAUDE.md (#1): every function,
 * including React components and arrow functions assigned to a constant, needs a doc
 * block with params, returns and throws. Do not disable them per file.
 */
import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import jsdoc from 'eslint-plugin-jsdoc'
import reactHooks from 'eslint-plugin-react-hooks'
import security from 'eslint-plugin-security'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'infra/**',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  security.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,mjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { jsdoc, 'react-hooks': reactHooks },
    rules: {
      // --- CLAUDE.md rule 1: TSDoc on every function -------------------------------
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            // Arrow/function expressions are covered by `contexts` below, so inline
            // callbacks (map, event props, rich-text tags) stay exempt as documented.
            FunctionExpression: false,
            ArrowFunctionExpression: false,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          // Inline single-expression callbacks passed to map/filter/event props are the
          // documented exception, so only arrows bound to a name are required.
          contexts: [
            'VariableDeclarator > ArrowFunctionExpression',
            'VariableDeclarator > FunctionExpression',
            'ExportDefaultDeclaration > ArrowFunctionExpression',
          ],
          checkConstructors: false,
        },
      ],
      'jsdoc/require-description': 'error',
      'jsdoc/require-param': ['error', { checkDestructuredRoots: false }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': ['error', { checkGetters: true }],
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-throws': 'error',
      'jsdoc/check-tag-names': ['error', { definedTags: ['remarks', 'packageDocumentation'] }],

      // --- CLAUDE.md rule 3: strict TypeScript ------------------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Security: no raw HTML injection on the web (apps/web/CLAUDE.md, CSP).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned. Render text through React instead.',
        },
      ],
    },
  },
  {
    // Tests document intent in their `it(...)` names; callbacks there need no TSDoc.
    files: ['**/*.test.{ts,tsx}', '**/e2e/**/*.ts', '**/*.config.{ts,mts,mjs}'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      // Security plugin false positives on test fixtures (fixed keys, no user input).
      'security/detect-object-injection': 'off',
    },
  },
)
