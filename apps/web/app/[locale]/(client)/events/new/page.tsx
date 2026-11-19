import { DEPOSIT_RATE_BPS } from '@thaala/shared'
import { BellRing, MessageSquareQuote, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EnquiryForm } from '@/components/enquiry/EnquiryForm'

type Props = { params: Promise<{ locale: string }> }

/**
 * Page title.
 *
 * @param props - Route params.
 * @returns Metadata.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'enquiry' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * "Post your event": the enquiry form plus a "What happens next" explainer.
 *
 * @param props - Route params.
 * @returns The page.
 */
export default async function PostEventPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('enquiry')
  const steps = [
    { icon: BellRing, title: t('nextAlertTitle'), body: t('nextAlertBody') },
    { icon: MessageSquareQuote, title: t('nextQuotesTitle'), body: t('nextQuotesBody') },
    // The percentage comes from the shared rule so copy and maths can't disagree.
    {
      icon: ShieldCheck,
      title: t('nextBookTitle'),
      body: t('nextBookBody', { percent: DEPOSIT_RATE_BPS / 100 }),
    },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-gray-600">{t('subtitle')}</p>

        <div className="mt-8 flex flex-wrap gap-8">
          <EnquiryForm />
          <aside className="flex w-full flex-col gap-4 lg:w-80">
            <div className="rounded-card bg-white p-6">
              <h2 className="font-display text-lg font-bold">{t('nextTitle')}</h2>
              <ol className="mt-4 flex flex-col gap-4 text-sm">
                {steps.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <Icon size={20} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
                    <div>
                      <div className="font-semibold">{title}</div>
                      <div className="text-gray-600">{body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
