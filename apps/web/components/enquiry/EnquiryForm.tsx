'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  BUDGET_BANDS,
  DISTRICTS,
  ENQUIRY_NOTES_MAX,
  enquiryDraftSchema,
  formatEventDate,
  GUEST_BANDS,
  MUSIC_STYLES,
  OCCASIONS,
  SONG_LANGUAGES,
  SOUND_SYSTEM,
  type EnquiryDraft,
} from '@thaala/shared'
import { buttonClasses, chipClasses, cn, inputClasses } from '@thaala/ui'
import { CheckCircle2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useForm, useWatch, type FieldError } from 'react-hook-form'
import { Link, useRouter } from '@/i18n/navigation'
import { postEnquiry } from '@/lib/actions'

/** A partly filled form: any field may still be missing. */
type DraftValues = { [K in keyof EnquiryDraft]?: EnquiryDraft[K] | undefined }

/** localStorage key for the unsent draft (docs/UX_GUIDELINES.md: long forms save drafts). */
export const DRAFT_KEY = 'thaala:enquiry-draft:v1'

/** No props: the form posts through the `postEnquiry` server action. */
export type EnquiryFormProps = Record<string, never>

/**
 * Read a saved draft, ignoring anything that no longer matches the schema.
 *
 * @returns The valid parts of the draft, or `null` if there is none or storage is blocked.
 *
 * @remarks
 * Security: the stored value is untrusted (any script on the origin or the user could
 * edit it), so it is parsed field by field and invalid fields are dropped.
 */
function loadDraft(): DraftValues | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const draft: Record<string, unknown> = {}
    // Validate each known field on its own so one stale or tampered value doesn't
    // throw away the rest of the user's work. Unknown keys are never copied.
    // Security: `key` comes from our own schema, never from the stored JSON, so the
    // object-injection warnings below are false positives.
    for (const [key, schema] of Object.entries(enquiryDraftSchema.shape)) {
      // eslint-disable-next-line security/detect-object-injection
      const result = schema.safeParse((parsed as Record<string, unknown>)[key])
      // eslint-disable-next-line security/detect-object-injection
      if (result.success && result.data !== undefined) draft[key] = result.data
    }
    return draft as DraftValues
  } catch {
    // Private mode or blocked storage: the form still works, just without drafts.
    return null
  }
}

/**
 * The "Post your event" form.
 *
 * Validates with the same Zod schema the API will use, on blur and on submit. Chips are
 * real radio/checkbox inputs, so keyboard and screen readers behave natively.
 *
 * @returns The form, or the "Your event is posted" confirmation after submitting.
 *
 * @remarks
 * Submits through the `postEnquiry` server action, which re-validates with the same
 * schema and calls the API with the session token (the browser never sees the token).
 * Server-side field errors (e.g. `dateInPast`) are shown on the right field.
 * Privacy: the draft lives only in this browser and holds no contact details.
 */
export function EnquiryForm() {
  const t = useTranslations('enquiry')
  const tAll = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [sent, setSent] = useState<{ draft: EnquiryDraft; id: string; matchedCount: number } | null>(null)
  const [restored, setRestored] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitted },
  } = useForm<EnquiryDraft>({
    resolver: zodResolver(enquiryDraftSchema),
    mode: 'onBlur',
    defaultValues: { musicStyles: [], songLanguages: [] },
  })

  // Restore a draft once, after mount (localStorage does not exist during SSR).
  useEffect(() => {
    const draft = loadDraft()
    if (draft && Object.keys(draft).length > 0) {
      // The form holds partial values until submit validates them, which is exactly what
      // a draft is; react-hook-form types `reset` with the final shape, so we widen here.
      reset({ musicStyles: [], songLanguages: [], ...draft } as EnquiryDraft)
      // Syncing from an external store (localStorage) that is only readable after mount;
      // reading it during render would make the server and client HTML differ.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestored(true)
    }
  }, [reset])

  const values = useWatch({ control })
  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
    } catch {
      // Storage full or blocked; drafts are a convenience, so ignore.
    }
  }, [values])

  /**
   * Called with schema-valid data.
   *
   * @param data - The validated enquiry.
   */
  function onValid(data: EnquiryDraft): void {
    setFormError(null)
    startTransition(async () => {
      const result = await postEnquiry(data)
      if (result.ok) {
        try {
          window.localStorage.removeItem(DRAFT_KEY)
        } catch {
          // Ignore: see above.
        }
        setSent({ draft: data, id: result.id, matchedCount: result.matchedCount })
        window.scrollTo({ top: 0 })
        return
      }
      if (result.code === 'VALIDATION_FAILED') {
        for (const [field, key] of Object.entries(result.fields)) {
          if (field in enquiryDraftSchema.shape) setError(field as keyof EnquiryDraft, { message: key })
        }
        setFormError(t('fixErrors'))
      } else if (result.code === 'UNAUTHENTICATED') {
        // Draft is saved locally, so nothing is lost while they sign in.
        router.push(`/sign-in?next=${encodeURIComponent(`/${locale}/events/new`)}`)
      } else {
        setFormError(t(result.code === 'RATE_LIMITED' ? 'errors.rateLimited' : 'errors.submitFailed'))
      }
    })
  }

  /**
   * Translate a schema error code to a message.
   *
   * @param error - The field error from react-hook-form (message is an i18n key).
   * @returns The translated message, or `undefined` when there is no error.
   */
  function errorText(error: FieldError | { message?: string } | undefined): string | undefined {
    if (!error?.message) return undefined
    const key = `errors.${error.message}`
    return t.has(key) ? t(key as 'errors.generic') : t('errors.generic')
  }

  if (sent) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center" role="status">
        <CheckCircle2 size={56} className="text-brand-600" aria-hidden />
        <h1 className="font-display text-3xl font-bold">{t('sentTitle')}</h1>
        <p className="text-gray-600">
          {t('sentMatched', {
            count: sent.matchedCount,
            date: formatEventDate(`${sent.draft.eventDate}T12:00:00+05:30`, locale),
            district: tAll(`districts.${sent.draft.district}`),
          })}
        </p>
        <Link href={`/events/${sent.id}/quotes`} className={buttonClasses('primary', 'lg', 'mt-2')}>
          {t('seeQuotes')}
        </Link>
      </div>
    )
  }

  const hasErrors = (isSubmitted && Object.keys(errors).length > 0) || formError !== null

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-8 rounded-card bg-white p-6 sm:p-8"
    >
      {restored && (
        <p role="status" className="rounded-input bg-brand-50 p-3 text-sm text-brand-900">
          {t('draftRestored')}
        </p>
      )}
      {/* react-hook-form moves focus to the first invalid field; this summary is announced. */}
      <p
        role="alert"
        className={cn(
          'rounded-input bg-red-50 p-3 text-sm font-semibold text-red-800',
          !hasErrors && 'hidden',
        )}
      >
        {formError ?? (hasErrors ? t('fixErrors') : '')}
      </p>

      <ChipGroup legend={t('occasion')} error={errorText(errors.occasion)} id="occasion">
        {OCCASIONS.map((o) => (
          <label key={o} className={chipClasses()}>
            <input type="radio" value={o} className="sr-only" {...register('occasion')} />
            {t(`occasions.${o}`)}
          </label>
        ))}
      </ChipGroup>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('date')} error={errorText(errors.eventDate)} id="eventDate">
          {(aria) => <input {...aria} type="date" className={inputClasses} {...register('eventDate')} />}
        </Field>
        <Field label={t('startTime')} error={errorText(errors.startTime)} id="startTime">
          {(aria) => <input {...aria} type="time" className={inputClasses} {...register('startTime')} />}
        </Field>
        <Field label={t('district')} error={errorText(errors.district)} id="district">
          {(aria) => (
            <select {...aria} className={inputClasses} defaultValue="" {...register('district')}>
              <option value="" disabled>
                {t('chooseDistrict')}
              </option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {tAll(`districts.${d}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('guests')} error={errorText(errors.guests)} id="guests">
          {(aria) => (
            <select {...aria} className={inputClasses} defaultValue="" {...register('guests')}>
              <option value="" disabled>
                {t('chooseGuests')}
              </option>
              {GUEST_BANDS.map((g) => (
                <option key={g} value={g}>
                  {t(`guestBands.${g}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label={`${t('venue')} (${tAll('common.optional')})`} error={errorText(errors.venue)} id="venue">
        {(aria) => (
          <input
            {...aria}
            placeholder={t('venuePlaceholder')}
            maxLength={120}
            className={inputClasses}
            {...register('venue', { setValueAs: (v: string) => (v.trim() === '' ? undefined : v) })}
          />
        )}
      </Field>

      <ChipGroup legend={t('musicStyle')} error={errorText(errors.musicStyles)} id="musicStyles">
        {MUSIC_STYLES.map((s) => (
          <label key={s} className={chipClasses()}>
            <input type="checkbox" value={s} className="sr-only" {...register('musicStyles')} />
            {t(`styles.${s}`)}
          </label>
        ))}
      </ChipGroup>

      <div className="grid gap-8 md:grid-cols-2">
        <ChipGroup legend={t('songLanguages')} error={errorText(errors.songLanguages)} id="songLanguages">
          {SONG_LANGUAGES.map((l) => (
            <label key={l} className={chipClasses()}>
              <input type="checkbox" value={l} className="sr-only" {...register('songLanguages')} />
              {tAll(`languages.${l}`)}
            </label>
          ))}
        </ChipGroup>
        <ChipGroup legend={t('sound')} error={errorText(errors.venueHasSound)} id="venueHasSound">
          {SOUND_SYSTEM.map((v) => (
            <label key={v} className={chipClasses()}>
              <input type="radio" value={v} className="sr-only" {...register('venueHasSound')} />
              {t(`soundOptions.${v}`)}
            </label>
          ))}
        </ChipGroup>
      </div>

      <ChipGroup legend={t('budget')} error={errorText(errors.budget)} id="budget">
        {BUDGET_BANDS.map((b) => (
          <label key={b} className={chipClasses()}>
            <input type="radio" value={b} className="sr-only" {...register('budget')} />
            {t(`budgetBands.${b}`)}
          </label>
        ))}
      </ChipGroup>

      <Field
        label={`${t('notes')} (${tAll('common.optional')})`}
        error={errorText(errors.notes)}
        hint={t('notesHelp')}
        id="notes"
      >
        {(aria) => (
          <textarea
            {...aria}
            rows={4}
            maxLength={ENQUIRY_NOTES_MAX}
            placeholder={t('notesPlaceholder')}
            className="w-full rounded-input border border-gray-300 p-3 text-sm font-normal aria-invalid:border-red-600"
            {...register('notes', { setValueAs: (v: string) => (v.trim() === '' ? undefined : v) })}
          />
        )}
      </Field>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-600">{t('privacy')}</span>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={buttonClasses('primary', 'lg')}
        >
          {t('submit')}
        </button>
      </div>
    </form>
  )
}

type GroupProps = { legend: string; error: string | undefined; id: string; children: ReactNode }

/**
 * A fieldset of chips with its legend and error message.
 *
 * @param props.legend - Visible group label.
 * @param props.error - Translated error, if any. Linked to the group for screen readers.
 * @param props.id - Stable id used to link the error.
 * @param props.children - The chip labels.
 * @returns The fieldset.
 */
function ChipGroup({ legend, error, id, children }: GroupProps) {
  const errorId = `${id}-error`
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-3 font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** ARIA wiring a {@link Field} hands to its control. */
type ControlAria = { 'aria-describedby'?: string; 'aria-invalid'?: true }

type FieldProps = {
  label: string
  hint?: string
  error: string | undefined
  id: string
  children: (aria: ControlAria) => ReactNode
}

/**
 * A labelled single input with optional hint and error.
 *
 * The label wraps the control, so it is always visible and associated
 * (docs/UX_GUIDELINES.md "Forms": no placeholder-only fields). The control receives the
 * hint/error ids through the render prop so screen readers announce them.
 *
 * @param props.label - Visible label text.
 * @param props.hint - Help text shown under the input.
 * @param props.error - Translated error, if any.
 * @param props.id - Stable id used to link hint and error.
 * @param props.children - Renders the control, spreading the given ARIA props onto it.
 * @returns The labelled field.
 */
function Field({ label, hint, error, id, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')
  const aria: ControlAria = {
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {label}
        {children(aria)}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
