'use client'

import { inputClasses } from '@thaala/ui'
import type { ChangeEvent } from 'react'

export type SortSelectProps = {
  /** Id of the filter form this select belongs to. */
  form: string
  label: string
  value: string
  options: { value: string; label: string }[]
}

/**
 * Sort dropdown that re-submits the filter form when changed.
 *
 * The select is part of the GET filter form (via `form=`), so without JavaScript the
 * user picks a sort and presses "Show results"; with JavaScript it applies at once.
 *
 * @param props - See {@link SortSelectProps}.
 * @returns A labelled select.
 */
export function SortSelect({ form, label, value, options }: SortSelectProps) {
  /**
   * Submit the owning form so the new sort is applied.
   *
   * @param e - The change event from the select.
   */
  function handleChange(e: ChangeEvent<HTMLSelectElement>): void {
    e.currentTarget.form?.requestSubmit()
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium whitespace-nowrap text-gray-700">{label}</span>
      <select name="sort" form={form} defaultValue={value} onChange={handleChange} className={inputClasses}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
