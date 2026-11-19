import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rating } from './Rating'

describe('Rating', () => {
  it('shows a compact rating and a full sentence for screen readers', () => {
    render(<Rating rating={4.9} reviews={38} label="Rated 4.9 out of 5 from 38 reviews" />)
    expect(screen.getByText('Rated 4.9 out of 5 from 38 reviews')).toBeDefined()
    expect(screen.getByText('4.9').getAttribute('aria-hidden')).toBe('true')
  })

  it('always shows one decimal place', () => {
    render(<Rating rating={5} reviews={1} label="x" />)
    expect(screen.getByText('5.0')).toBeDefined()
  })
})
