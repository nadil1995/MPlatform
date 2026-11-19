/**
 * Liveness probe for the ECS / Docker HEALTHCHECK (apps/web/Dockerfile).
 *
 * @returns 200 with a tiny JSON body. No dependencies are checked, so a slow API
 *   never makes ECS kill healthy web tasks.
 *
 * @remarks
 * Security: public by design; returns no version, host or environment details.
 */
export function GET(): Response {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
