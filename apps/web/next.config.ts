import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const config: NextConfig = {
  // Required by apps/web/Dockerfile (copies .next/standalone).
  output: 'standalone',
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@thaala/shared', '@thaala/ui'],
  // Security: don't advertise the framework.
  poweredByHeader: false,
  reactStrictMode: true,
}

export default withNextIntl(config)
