import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@thaala/shared/i18n/en.json'
import { DRAFT_KEY, EnquiryForm } from './EnquiryForm'

// The locale-aware Link needs the Next router; a plain anchor is enough here.
const push = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push }),
}))

// The server action is the network boundary; the API behaviour is tested in apps/api.
const postEnquiry = vi.fn()
vi.mock('@/lib/actions', () => ({ postEnquiry: (input: unknown) => postEnquiry(input) }))

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Colombo">
      <EnquiryForm />
    </NextIntlClientProvider>,
  )

describe('EnquiryForm', () => {
  beforeEach(() => {
    window.localStorage.clear()
    postEnquiry.mockReset()
    push.mockReset()
  })
  afterEach(cleanup)

  it('shows translated errors, not schema codes, when submitted empty', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: en.enquiry.submit }))
    expect(await screen.findByText(en.enquiry.errors.occasionRequired)).toBeDefined()
    expect(screen.getByText(en.enquiry.errors.styleRequired)).toBeDefined()
    expect(screen.queryByText('occasionRequired')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe(en.enquiry.fixErrors)
  })

  it('links field errors to their inputs for screen readers', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: en.enquiry.submit }))
    const date = await screen.findByLabelText(en.enquiry.date)
    expect(date.getAttribute('aria-invalid')).toBe('true')
    expect(date.getAttribute('aria-describedby')).toBe('eventDate-error')
  })

  /** Fill every required field with valid values. */
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByLabelText(en.enquiry.occasions.wedding))
    await user.type(screen.getByLabelText(en.enquiry.date), '2027-02-13')
    await user.type(screen.getByLabelText(en.enquiry.startTime), '19:00')
    await user.selectOptions(screen.getByLabelText(en.enquiry.district), 'colombo')
    await user.selectOptions(screen.getByLabelText(en.enquiry.guests), '150to250')
    await user.click(screen.getByLabelText(en.enquiry.styles.liveBand))
    await user.click(screen.getByLabelText(en.languages.si))
    await user.click(screen.getByLabelText(en.enquiry.soundOptions.no))
    await user.click(screen.getByLabelText(en.enquiry.budgetBands['50kTo150k']))
  }

  it('shows a server-side field error on the right field', async () => {
    postEnquiry.mockResolvedValue({
      ok: false,
      code: 'VALIDATION_FAILED',
      fields: { eventDate: 'dateInPast' },
    })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: en.enquiry.submit }))
    expect(await screen.findByText(en.enquiry.errors.dateInPast)).toBeDefined()
  })

  it('shows the daily-limit message', async () => {
    postEnquiry.mockResolvedValue({ ok: false, code: 'RATE_LIMITED' })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: en.enquiry.submit }))
    expect(await screen.findByText(en.enquiry.errors.rateLimited)).toBeDefined()
  })

  it('sends signed-out users to sign-in and keeps their draft', async () => {
    postEnquiry.mockResolvedValue({ ok: false, code: 'UNAUTHENTICATED' })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: en.enquiry.submit }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/sign-in?next=')))
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain('wedding')
  })

  it('posts a complete event and shows the confirmation', async () => {
    postEnquiry.mockResolvedValue({ ok: true, id: '11111111-1111-4111-8111-111111111111', matchedCount: 4 })
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByLabelText(en.enquiry.occasions.wedding))
    await user.type(screen.getByLabelText(en.enquiry.date), '2027-02-13')
    await user.type(screen.getByLabelText(en.enquiry.startTime), '19:00')
    await user.selectOptions(screen.getByLabelText(en.enquiry.district), 'colombo')
    await user.selectOptions(screen.getByLabelText(en.enquiry.guests), '150to250')
    await user.click(screen.getByLabelText(en.enquiry.styles.liveBand))
    await user.click(screen.getByLabelText(en.languages.si))
    await user.click(screen.getByLabelText(en.enquiry.soundOptions.no))
    await user.click(screen.getByLabelText(en.enquiry.budgetBands['50kTo150k']))
    await user.click(screen.getByRole('button', { name: en.enquiry.submit }))

    expect(await screen.findByRole('heading', { name: en.enquiry.sentTitle })).toBeDefined()
    expect(screen.getByText(/alerted 4 musicians who are free on Sat, 13 Feb 2027 in Colombo/)).toBeDefined()
    expect(screen.getByRole('link', { name: en.enquiry.seeQuotes }).getAttribute('href')).toBe(
      '/events/11111111-1111-4111-8111-111111111111/quotes',
    )
    expect(postEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ district: 'colombo', budget: '50kTo150k' }),
    )
    // The draft is cleared once the event is posted.
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('restores a saved draft and drops tampered fields', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ occasion: 'birthday', district: 'atlantis', notes: 'Baila please' }),
    )
    renderForm()
    expect(await screen.findByText(en.enquiry.draftRestored)).toBeDefined()
    expect((screen.getByLabelText(en.enquiry.occasions.birthday) as HTMLInputElement).checked).toBe(true)
  })

  it('ignores a corrupt draft', () => {
    window.localStorage.setItem(DRAFT_KEY, '{not json')
    renderForm()
    expect(screen.queryByText(en.enquiry.draftRestored)).toBeNull()
  })
})
