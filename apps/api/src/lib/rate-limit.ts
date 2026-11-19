/**
 * In-memory fixed-window rate limiter, one per API task.
 *
 * WAF enforces the global per-IP limits (docs/SECURITY.md §6); this catches abuse that
 * gets past it, per task. Limits that must hold across tasks (e.g. 5 enquiries a day)
 * are counted in Postgres instead.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  /**
   * Create a limiter.
   *
   * @param limit - Requests allowed per window.
   * @param windowMs - Window length in milliseconds.
   * @param now - Clock, injectable for tests.
   */
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Count one hit for a key.
   *
   * @param key - Who is being limited (e.g. a hashed IP or a user id).
   * @returns True if allowed, false if over the limit.
   */
  take(key: string): boolean {
    const t = this.now()
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= t) {
      // Opportunistic cleanup keeps memory bounded without a timer.
      if (this.hits.size > 50_000) this.hits.clear()
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= this.limit
  }
}
