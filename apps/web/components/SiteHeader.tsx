import { buttonClasses, cn } from '@thaala/ui'
import { Bell, MessageCircle } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Link } from '@/i18n/navigation'
import { signOut } from '@/lib/actions'
import { api } from '@/lib/api'
import { LanguageSwitcher } from './LanguageSwitcher'

export type SiteHeaderProps = {
  /** Client mode is teal, musician mode is magenta, so users always know where they are. */
  mode?: 'client' | 'musician'
}

/**
 * Top bar on every page: logo, main nav, language switcher, account and mode switch.
 *
 * Reads the signed-in user from the API (cached per request). Messages and
 * notifications stay disabled until chat (P3-02) and the notification centre exist.
 *
 * @param props - See {@link SiteHeaderProps}.
 * @returns The header element.
 */
export async function SiteHeader({ mode = 'client' }: SiteHeaderProps) {
  const [t, tc, me, locale] = await Promise.all([
    getTranslations('header'),
    getTranslations('common'),
    api.me(),
    getLocale(),
  ])
  const isMusician = mode === 'musician'
  const iconButton =
    'flex h-11 w-11 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-2xl font-bold text-brand-600">
          {tc('brand')}
        </Link>
        {isMusician ? (
          <span className="rounded-full bg-gig-600 px-3 py-1 text-xs font-bold text-white">
            {t('musicianMode')}
          </span>
        ) : (
          <nav
            aria-label={t('mainNav')}
            className="hidden items-center gap-6 text-sm font-medium text-gray-700 md:flex"
          >
            <Link href="/musicians" className="hover:text-brand-600">
              {t('findMusicians')}
            </Link>
            <Link href="/events/new" className="hover:text-brand-600">
              {t('postEvent')}
            </Link>
            <Link href="/events" className="hover:text-brand-600">
              {t('myQuotes')}
            </Link>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Suspense: the switcher reads the query string, which is only known per request. */}
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <button type="button" disabled aria-label={t('messages')} className={iconButton}>
            <MessageCircle size={20} aria-hidden />
          </button>
          <button type="button" disabled aria-label={t('notifications')} className={iconButton}>
            <Bell size={20} aria-hidden />
          </button>
          {me ? (
            <>
              {(isMusician || me.roles.includes('musician')) && (
                <Link
                  href={isMusician ? '/' : '/musician/dashboard'}
                  className={cn(
                    buttonClasses(isMusician ? 'secondary' : 'dark', 'sm'),
                    'hidden sm:inline-flex',
                  )}
                >
                  {isMusician ? t('switchToClient') : t('forMusicians')}
                </Link>
              )}
              <form action={signOut}>
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  title={tc('signedInAs', { name: me.displayName })}
                  className={buttonClasses('secondary', 'sm')}
                >
                  {tc('signOut')}
                </button>
              </form>
            </>
          ) : (
            <Link href="/sign-in" className={buttonClasses('dark', 'sm')}>
              {tc('signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
