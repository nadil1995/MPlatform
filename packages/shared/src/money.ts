/**
 * Money helpers shared by the API, web and mobile apps.
 *
 * All amounts are integer cents (LKR × 100), never floats (docs/CODING_STANDARDS.md §2).
 */

/**
 * The client's deposit as basis points of the quote total (3000 = 30%).
 *
 * 30% is the Encore-style split agreed for launch: enough to cover the musician's
 * commitment if the client cancels late, low enough not to put clients off booking early.
 */
export const DEPOSIT_RATE_BPS = 3000

/**
 * Compute the deposit for a quote total.
 *
 * Rounds to the nearest whole rupee so clients never see cents on screen and the
 * balance (total − deposit) is also a whole-rupee amount.
 *
 * @param totalCents - Quote total in cents, from the database. A non-negative safe integer.
 * @returns The deposit in cents, a multiple of 100.
 * @throws {RangeError} When `totalCents` is negative, fractional or not a safe integer.
 *
 * @remarks
 * Security: callers must pass a total read from the database, never one from the
 * request body (CLAUDE.md rule 8). This function only does arithmetic.
 *
 * @example
 * calculateDepositCents(12_000_000) // 3_600_000 (LKR 36,000)
 */
export function calculateDepositCents(totalCents: number): number {
  assertCents(totalCents)
  const depositRupees = Math.round((totalCents / 100) * (DEPOSIT_RATE_BPS / 10_000))
  return depositRupees * 100
}

/**
 * Format an amount for display, e.g. `LKR 120,000`.
 *
 * Display never shows decimals (docs/UX_GUIDELINES.md "Formatting"); amounts that are not
 * whole rupees are rounded for display only.
 *
 * @param cents - Amount in cents. A non-negative safe integer.
 * @returns The formatted string with the `LKR` prefix and en-US digit grouping.
 * @throws {RangeError} When `cents` is negative, fractional or not a safe integer.
 */
export function formatLKR(cents: number): string {
  assertCents(cents)
  return `LKR ${Math.round(cents / 100).toLocaleString('en-US')}`
}

/**
 * Check that a value is a valid cents amount.
 *
 * @param cents - The value to check.
 * @throws {RangeError} When it is not a non-negative safe integer.
 */
function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError('Amount must be a non-negative integer number of cents')
  }
}
