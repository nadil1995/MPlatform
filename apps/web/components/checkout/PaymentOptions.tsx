'use client'

import { buttonClasses, cn } from '@thaala/ui'
import { CreditCard, Landmark, ShieldCheck, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export type PaymentOptionsProps = {
  /** Deposit already formatted on the server, e.g. "LKR 36,000". Display only. */
  depositLabel: string
}

/**
 * Payment method choice, terms checkbox and the pay button for checkout.
 *
 * Display-only until PayHere (P4-02) and slip upload (P4-03) exist: the buttons are
 * disabled and say so. There is deliberately no "paid" state here.
 *
 * @param props - See {@link PaymentOptionsProps}.
 * @returns The payment section.
 *
 * @remarks
 * Security: this component never computes or submits an amount. When P4-02 lands, the
 * pay button calls a server action that gets signed checkout fields from the API, and
 * success is only ever taken from the verified PayHere webhook (CLAUDE.md rule 8).
 */
export function PaymentOptions({ depositLabel }: PaymentOptionsProps) {
  const t = useTranslations('checkout')
  const [method, setMethod] = useState<'card' | 'bank'>('card')

  const option = 'flex cursor-pointer items-start gap-3 rounded-input border border-gray-300 p-4'
  const selected = 'has-checked:border-brand-600 has-checked:bg-brand-50'

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-semibold">{t('payWith')}</legend>
        <label className={cn(option, selected)}>
          <input
            type="radio"
            name="method"
            value="card"
            checked={method === 'card'}
            onChange={() => setMethod('card')}
            className="mt-1 accent-brand-600"
          />
          <CreditCard size={22} className="mt-0.5 shrink-0 text-gray-700" aria-hidden />
          <span>
            <span className="block font-semibold">{t('card')}</span>
            <span className="text-sm text-gray-600">{t('cardBody')}</span>
          </span>
        </label>
        <label className={cn(option, selected)}>
          <input
            type="radio"
            name="method"
            value="bank"
            checked={method === 'bank'}
            onChange={() => setMethod('bank')}
            className="mt-1 accent-brand-600"
          />
          <Landmark size={22} className="mt-0.5 shrink-0 text-gray-700" aria-hidden />
          <span>
            <span className="block font-semibold">{t('bank')}</span>
            <span className="text-sm text-gray-600">{t('bankBody')}</span>
          </span>
        </label>
      </fieldset>

      {method === 'bank' && (
        <div className="rounded-input border border-dashed border-gray-300 p-5 text-sm">
          <div className="font-semibold">{t('transferTo')}</div>
          {/* Real account details come from the API per booking (P4-03), never hard-coded. */}
          <div className="mt-1 text-gray-700">{t('bankDetailsLater')}</div>
          <button type="button" disabled className={buttonClasses('secondary', 'sm', 'mt-4')}>
            <Upload size={16} aria-hidden /> {t('uploadSlip')}
          </button>
        </div>
      )}

      <div className="flex gap-3 rounded-input bg-brand-50 p-4 text-sm text-brand-900">
        <ShieldCheck size={22} className="shrink-0" aria-hidden />
        <p>{t('protection')}</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" /> {t('agree')}
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          aria-describedby="payment-not-open"
          className={buttonClasses('primary', 'lg')}
        >
          {method === 'card' ? t('pay', { amount: depositLabel }) : t('submitSlip')}
        </button>
        <p id="payment-not-open" className="text-center text-sm text-gray-600">
          {t('notYetOpen')}
        </p>
      </div>
    </div>
  )
}
