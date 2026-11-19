# Security

Baseline: **OWASP ASVS 4.0 Level 2** for the API and web, **OWASP MASVS L1** for the mobile
app, OWASP Top 10 as the review checklist. When in doubt, choose the safer option and leave
a comment explaining it.

## 1. Threat model (what we are protecting)

| Asset | Main threats | Key controls |
|---|---|---|
| Deposits and payouts | Fake payment confirmations, amount tampering, payout fraud | Server-side amounts, verified webhook signatures, append-only ledger, manual payout approval, audit log |
| User PII (names, phones, emails, event locations) | IDOR, data scraping, leaks in logs | Ownership checks, rate limits, masked contacts, log redaction, encryption at rest |
| Musician bank details | Theft, insider misuse | Field-level encryption (KMS), admin-only decrypt, audit every read |
| Accounts | OTP abuse, SMS pumping, credential stuffing, session theft | WAF + per-phone OTP limits, short tokens, HttpOnly cookies, MFA for admins |
| Reviews and reputation | Fake reviews, extortion | Reviews only from completed bookings, moderation queue |
| Uploads | Malware, oversized files, location leaks in EXIF | Presigned uploads with limits, malware scan, EXIF stripped, re-encoding |
| Platform (disintermediation) | Users swapping numbers to skip fees | Contact masking until booking confirmed |

## 2. Authentication

- **Cognito user pool** (Essentials). Sign-in: phone OTP (primary), Google, Apple.
- OTP: 6 digits, 5-minute expiry, max 5 attempts per code, max **5 OTP sends per phone per
  hour** and **20 per IP per hour** (enforced in the custom SMS sender Lambda/route and in
  WAF). Block premium-rate and non-+94 ranges unless the country is allowlisted
  (protects against SMS pumping).
- Access token 15 min, refresh token 30 days with rotation. Revoke refresh tokens on
  logout, password/phone change and account deletion.
- **Verify JWTs** with `aws-jwt-verify` (issuer, audience/client id, `token_use`, expiry).
  Never decode without verifying.
- Web: tokens only in encrypted `HttpOnly; Secure; SameSite=Lax` cookies set by the BFF.
  Never in `localStorage` or JS-readable cookies. CSRF: SameSite plus a double-submit token
  on state-changing BFF routes.
- Mobile: tokens only in `expo-secure-store`. Never AsyncStorage.
- **Admins**: separate Cognito group, TOTP MFA required, 8-hour session, admin routes on a
  separate path with stricter WAF rules (optionally an IP allowlist).

## 3. Authorization

- Deny by default. Each route declares `auth: 'public' | 'user' | 'musician' | 'admin'`.
- **Ownership checks live in the service layer**, using policy helpers in
  `apps/api/src/policies/` (e.g. `canViewEnquiry(user, enquiry)`). Repositories take the
  acting user id and scope queries by it, so a missing check fails closed.
- Every endpoint with an id in the path has an IDOR test: user B requests user A's
  resource and must get `404` (not `403`, to avoid confirming existence).
- Role changes (becoming a musician, admin grants) are audited.

## 4. Input and output

- Zod validation on every body, query, param, header, webhook and queue message. Unknown
  keys are stripped (`.strict()` where clients must not send extras).
- Limits: JSON body 100 KB, strings capped per field, arrays capped, pagination max 50.
- SQL only through Drizzle (parameterised). No `sql.raw` with user input.
- Output encoding: React escapes by default. `dangerouslySetInnerHTML` is banned
  (ESLint rule). User text is plain text only, no HTML or Markdown rendering.
- Errors: a standard shape `{ error: { code, message, requestId } }`. Never return stack
  traces, SQL errors or internal ids of other users.

## 5. HTTP security

- TLS 1.2+ everywhere (CloudFront security policy `TLSv1.2_2021`). HSTS with preload once
  stable.
- Headers (Next.js middleware + Hono `secureHeaders`): strict CSP with nonces,
  `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal.
- CORS: explicit allowlist of the web origins. No `*` with credentials.
- WebSocket: authenticate with the access token in the **first message** (not the URL,
  because URLs get logged). Re-check membership of the conversation on every message.
  Limit message size (4 KB) and rate (20 msgs / 10 s per connection).

## 6. Rate limiting and abuse

- AWS WAF managed rules (Core, Known Bad Inputs, IP reputation, Bot Control on auth paths)
  plus rate rules per IP.
- App-level limits (Redis-free, using Postgres or in-memory token buckets per task with
  WAF as the global limit): OTP sends, enquiry creation (5/day per user), quotes, chat,
  review submission, search (to stop scraping).
- Chat and quotes are scanned for phone numbers, emails, WhatsApp links and bank details
  before a booking is confirmed; matches are masked and logged as a moderation signal.

## 7. Payments (PayHere)

- The server creates the order (`order_id`, amount, currency `LKR`) from the booking in the
  database and generates the checkout `hash` server-side. The merchant secret never leaves
  the server.
- The `notify_url` webhook handler must, in this order:
  1. Validate the payload shape with Zod.
  2. Recompute `md5sig` = `UPPER(MD5(merchant_id + order_id + payhere_amount +
     payhere_currency + status_code + UPPER(MD5(merchant_secret))))` and compare it in
     constant time. (Confirm the formula against the current PayHere docs during
     implementation.)
  3. Check that the order exists, the amount and currency match the booking, and the
     booking is still `pending_payment`.
  4. Be idempotent: a unique constraint on `(provider, provider_payment_id)` means
     repeated webhooks do nothing.
  5. Write the ledger entry and the status change **in one transaction**, plus an audit log row.
- The browser `return_url` only shows "processing", then polls the booking status.
- Bank transfer slips are reviewed by an admin before confirmation.
- Payouts: generated as `payout_due`, approved by an admin (four-eyes for amounts over a
  threshold), then marked `payout_sent` with a reference.
- Never store card data. PayHere handles it (keeps us out of PCI DSS card-data scope).

## 8. Files and media

- Upload flow: API issues a **presigned S3 POST** with `content-length-range` (images ≤ 10 MB,
  video ≤ 200 MB) and an allowed content-type list. Keys are random UUIDs, never user
  filenames.
- Raw bucket is private and versioned. GuardDuty Malware Protection for S3 (or ClamAV in
  the worker) scans every object. Only clean files are processed.
- The worker checks the real file type from magic bytes, strips all EXIF/metadata
  (including GPS), re-encodes images to WebP and transcodes video. Only outputs go to the
  public bucket.
- Public media served through CloudFront with Origin Access Control. No public bucket ACLs.

## 9. Secrets

- Runtime secrets in **AWS Secrets Manager**, injected into ECS tasks as `secrets` (not
  plain environment variables in the task definition). Rotate the DB password automatically.
- Jenkins uses an IAM role (instance profile or OIDC), never long-lived AWS keys. Third-party
  tokens (Expo, Slack) are Jenkins credentials, used with `withCredentials` and masked.
- `.env` is for local dev only, git-ignored, and Claude Code is denied read access to it.
- `gitleaks` runs in Jenkins and as a pre-commit hook. A leaked secret is rotated
  immediately, then removed from history.

## 10. Infrastructure

- Private subnets for ECS tasks and RDS. Only the ALB is reachable, and only from CloudFront
  (managed prefix list + secret origin header).
- Security groups least-privilege: ALB → web/api ports only; api/worker → RDS 5432 only.
- RDS: encrypted with KMS, no public access, IAM auth or rotated password, automated
  backups (7 days staging, 35 days prod), deletion protection in prod.
- S3: Block Public Access on, SSE-KMS, TLS-only bucket policies.
- IAM: one task role per service with only the actions it needs. No `*` resources except
  where AWS requires it.
- CloudTrail, GuardDuty and AWS Config on in every account. Alerts to email/Slack.

## 11. Containers and supply chain

- Base images pinned by digest, rebuilt weekly. Multi-stage builds; runtime images contain
  only production dependencies and run as a **non-root user** with a read-only root
  filesystem, all Linux capabilities dropped, `initProcessEnabled` set in ECS.
- Jenkins gates: `gitleaks` (secrets), `semgrep` (SAST), `pnpm audit --audit-level high`
  plus `osv-scanner` (dependencies), `trivy` (image CVEs, fails on HIGH/CRITICAL with a fix
  available), SBOM generated with `syft` and stored with the build.
- Lockfile required (`pnpm install --frozen-lockfile`). New dependencies need a reason in
  the PR and must be actively maintained.

## 12. Mobile app

- No secrets in the bundle (anything in the app is public). Only public config:
  API URL, Cognito client id, PayHere sandbox/live flag.
- Deep links: validate every parameter. Never auto-perform actions from a link.
- Disable screenshots on payment screens (Android `FLAG_SECURE`).
- Release builds strip logs. Consider certificate pinning after launch (it needs a
  rotation plan).
- Fill in the iOS privacy manifest and Google Play Data Safety form from
  `docs/DATA_HANDLING.md`.

## 13. Logging, monitoring and incidents

- Structured JSON logs (pino) with request id, user id (internal UUID only), route, status
  and latency. **Redaction list** in `apps/api/src/lib/logger.ts` covers authorization
  headers, cookies, phone, email, names, addresses, message bodies and payment fields.
- Audit log table (append-only) for: logins, role changes, admin actions, payment and
  payout changes, data exports and deletions, bank detail reads.
- Alarms: 5xx rate, p95 latency, webhook failures, DLQ depth, OTP send spikes, WAF blocks.
- Incident response: see `docs/DATA_HANDLING.md#breach-response`.

## 14. Security review checklist (used by `/security-review`)

- [ ] Every new route has an auth level and an ownership check, with an IDOR test
- [ ] All inputs Zod-validated, with size limits
- [ ] No string-built SQL, no `dangerouslySetInnerHTML`, no `eval`/`new Function`
- [ ] Money computed on the server; webhook verified, idempotent, transactional
- [ ] No secrets or PII in code, logs, errors, URLs or analytics events
- [ ] Uploads go through the presigned + scan + re-encode pipeline
- [ ] Rate limits on anything that sends SMS/email or creates content
- [ ] New dependencies justified and audited
- [ ] Docker and infra changes keep non-root, private subnets and least-privilege IAM
