import { buttonClasses } from '@thaala/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { signInAsDev } from '@/lib/actions'
import { api } from '@/lib/api'
import { devSignInEnabled } from '@/lib/env'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Page title.
 *
 * @param props - Route params.
 * @returns Metadata (never indexed).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signIn' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Sign-in page.
 *
 * Locally it lists the seeded test accounts (dev sign-in). Elsewhere it shows a notice
 * until phone OTP / Google / Apple sign-in arrives with Cognito (P1-01, P1-02).
 *
 * @param props - Route params and `next` (where to go after signing in).
 * @returns The page.
 *
 * @remarks
 * Security: the `next` value is re-checked by the server action (open-redirect guard).
 */
export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signIn')
  const next = (await searchParams).next
  const enabled = devSignInEnabled()
  const users = enabled ? (await api.devUsers()).items : []

  const groups = [
    {
      label: t('clients'),
      items: users.filter((u) => !u.roles.includes('musician') && !u.roles.includes('admin')),
    },
    { label: t('musicians'), items: users.filter((u) => u.roles.includes('musician')) },
    { label: t('admins'), items: users.filter((u) => u.roles.includes('admin')) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      {!enabled ? (
        <p className="mt-4 text-gray-600">{t('unavailable')}</p>
      ) : (
        <>
          <p className="mt-2 text-gray-600">{t('devBody')}</p>
          {groups.map((g) => (
            <section key={g.label} className="mt-8">
              <h2 className="font-display text-lg font-bold">{g.label}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {g.items.map((u) => (
                  <li key={u.id}>
                    <form action={signInAsDev}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="locale" value={locale} />
                      {typeof next === 'string' && <input type="hidden" name="next" value={next} />}
                      <button
                        type="submit"
                        className={buttonClasses('secondary', 'md', 'w-full justify-start')}
                      >
                        {t('continueAs', { name: u.displayName })}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
