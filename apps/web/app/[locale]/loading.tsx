import { useTranslations } from 'next-intl'
import { PageSkeleton } from '@/components/Skeleton'

/**
 * Loading state shown while a localised page streams in.
 *
 * @returns A layout-shaped skeleton.
 */
export default function Loading() {
  const t = useTranslations('common')
  return <PageSkeleton label={t('loading')} />
}
