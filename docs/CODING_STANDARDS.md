# Coding standards

## 1. Comments: every function is documented

**Rule:** every function — exported or internal, including React components, hooks,
route handlers, class methods, and arrow functions assigned to a constant — has a TSDoc
block. ESLint (`eslint-plugin-jsdoc`, `require-jsdoc` + `require-param` + `require-returns`
+ `require-throws`) fails the build otherwise. The only exception is inline callbacks
passed directly to `map`/`filter`/event props when they are a single expression.

### Template

```ts
/**
 * One sentence: what this does, in plain words.
 *
 * Why it exists / the business rule it implements, in one to three sentences.
 *
 * @param name - What it is, units, allowed range, where it comes from (trusted or not).
 * @returns What comes back, including the empty case.
 * @throws {AppError} `CODE_NAME` — when and why.
 *
 * @remarks
 * Security: any check this function relies on or performs (e.g. "caller must have
 * verified ownership", "amount is computed here, never taken from input").
 * Side effects: database writes, events published, messages sent.
 *
 * @example
 * const deposit = calculateDeposit(12_000_000) // 3_600_000 (cents)
 */
```

### Example: a service function

```ts
/**
 * Accept a musician's quote and create a booking awaiting the deposit.
 *
 * Only the client who owns the enquiry may accept, and only while the quote is
 * still `sent` and unexpired. Accepting one quote declines the others for the
 * same enquiry so musicians are not left waiting.
 *
 * @param actor - The authenticated user (from the verified JWT, never the request body).
 * @param quoteId - UUID of the quote, already validated by the route schema.
 * @returns The new booking, with the deposit amount computed from the quote price.
 * @throws {AppError} `NOT_FOUND` — quote missing or not owned by the actor (we do not
 *   reveal which, to avoid confirming that other users' ids exist).
 * @throws {AppError} `QUOTE_NOT_ACCEPTABLE` — quote expired, withdrawn or already handled.
 *
 * @remarks
 * Security: ownership is checked inside the transaction with `SELECT … FOR UPDATE`
 * so two parallel accepts cannot create two bookings.
 * Side effects: writes `bookings`, updates `quotes`, publishes `BookingCreated`.
 */
export async function acceptQuote(actor: Actor, quoteId: string): Promise<Booking> {
  // Lock the quote row so concurrent requests are serialised (prevents double booking).
  return db.transaction(async (tx) => {
    const quote = await quotesRepo.findForClientForUpdate(tx, quoteId, actor.userId)
    if (!quote) throw new AppError('NOT_FOUND')
    // Business rule: quotes expire, and an expired price must not be honoured.
    if (quote.status !== 'sent' || quote.expiresAt < new Date()) {
      throw new AppError('QUOTE_NOT_ACCEPTABLE')
    }
    // Deposit is computed here from the stored price, never from client input.
    const depositCents = calculateDeposit(quote.priceCents)
    …
  })
}
```

### Example: a React component

```tsx
/**
 * Card showing one quote in the comparison list.
 *
 * Highlights the best match and shows what is included, so clients compare
 * like with like rather than on price alone.
 *
 * @param props.quote - Quote data from the API (already scoped to this client).
 * @param props.onBook - Called when the client chooses to book. The parent starts checkout.
 * @returns The rendered card.
 */
export function QuoteCard({ quote, onBook }: QuoteCardProps) { … }
```

### Inline comments

- Explain **why**, not what. `// Masked until booking so users can't bypass the deposit` ✔.
  `// set x to 1` ✘.
- Mark every security decision with `// Security:`.
- Mark workarounds with `// Workaround:` plus a link or reason and when it can be removed.
- `TODO` only with an issue number: `// TODO(#123): …`.

### Other files

- Every Bash script starts with a header comment (purpose, usage, required env vars,
  exit codes), uses `set -euo pipefail`, and comments each step.
- Dockerfiles and the Jenkinsfile comment every stage and every non-obvious flag.
- SQL migrations start with a comment saying what changes and how to roll back.

## 2. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any`. Use `unknown` and narrow it. Types for external data come from Zod (`z.infer`).
- Prefer pure functions for business rules (pricing, matching, state transitions) so they
  are easy to test.
- Money is an integer number of **cents** (LKR × 100) in a `bigint`-safe range. Never floats.
- Dates are stored as `timestamptz` in UTC and shown in `Asia/Colombo`.

## 3. Errors

- Throw `AppError(code, details?)`. Codes are listed in `packages/shared/errors.ts` and map
  to HTTP statuses in one place.
- Never swallow errors. Log once at the edge with the request id.

## 4. Testing

- Vitest for units and integration (real Postgres in Docker, run with Testcontainers or the
  compose database, never mocks for the DB layer).
- Every route: happy path, validation failure, unauthenticated, **another user's resource**
  (IDOR), and rate limit where relevant.
- Payment webhook: valid signature, bad signature, amount mismatch, replayed webhook.
- Playwright E2E for the core flow: search → enquiry → quote → checkout (PayHere sandbox
  stub) → confirmation.
- Coverage target: 80% lines on `apps/api/src/modules/**`, 100% on pricing and state machines.

## 5. Git

- Branches: `feat/…`, `fix/…`, `chore/…`. Conventional Commits.
- PRs are small (< 400 lines changed where possible), with a description, test evidence and
  the security checklist if relevant.
- `main` is protected: Jenkins must pass, plus one human review.
