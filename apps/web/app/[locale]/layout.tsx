import type { Metadata } from 'next'
import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil, Space_Grotesk } from 'next/font/google'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PreviewBanner } from '@/components/PreviewBanner'
import { routing } from '@/i18n/routing'
import '../globals.css'

// Fonts are self-hosted by next/font at build time: no requests to Google from the
// browser (privacy, and the CSP only allows our own origin).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})
// Not preloaded: only Sinhala/Tamil pages use them, so English pages don't pay for them.
const notoSinhala = Noto_Sans_Sinhala({
  subsets: ['sinhala'],
  variable: '--font-noto-sinhala',
  display: 'swap',
  preload: false,
})
const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-noto-tamil',
  display: 'swap',
  preload: false,
})

type Props = { children: ReactNode; params: Promise<{ locale: string }> }

/**
 * Default title and description for the locale; pages override them.
 *
 * @param props - Route params.
 * @returns Metadata with a title template and hreflang alternates.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  return {
    title: { default: t('metaTitle'), template: '%s' },
    description: t('metaDescription'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  }
}

/**
 * Root layout for every localised page: html/body, fonts, i18n provider, banners.
 *
 * @param props - Children and the `locale` route param.
 * @returns The document shell.
 * @throws Next.js `notFound()` for an unknown locale segment.
 *
 * @remarks
 * Security: `connection()` forces per-request rendering. The CSP nonce is generated per
 * request in proxy.ts, and a statically prerendered page would have no nonce, so its
 * scripts would be blocked.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  await connection()
  const t = await getTranslations('common')

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} ${notoSinhala.variable} ${notoTamil.variable}`}
    >
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
          <PreviewBanner />
          <OfflineBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
