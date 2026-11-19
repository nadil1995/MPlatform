# Architecture

## Overview

```
 Mobile app (Expo) ─┐
                    │ HTTPS / WSS
 Browser ── Next.js web (BFF) ──┐
                                ▼
            CloudFront + AWS WAF (TLS, rate limits, geo/bot rules)
                                │
                     Application Load Balancer (private origin)
                     │                         │
          ECS Fargate: web (Next.js)   ECS Fargate: api (Hono, REST + WebSocket)
                                               │ publishes events
                                               ▼
                                     SQS queues ──► ECS Fargate: worker
                                               │
            RDS PostgreSQL (private, KMS-encrypted, Multi-AZ in prod)
            S3 (media-raw private, media-public via CloudFront OAC)
            Cognito (auth) · SES (email) · Secrets Manager · CloudWatch

 External: PayHere (payments) · Text.lk (SMS/OTP) · WhatsApp Cloud API · Expo Push
```

Region: `ap-south-1` (Mumbai), the closest AWS region to Sri Lanka.
Environments: `dev` (local Docker), `staging`, `prod`. Staging and prod are separate AWS
accounts.

## Containers

| Image | Command | Purpose |
|---|---|---|
| `thaala-api` | `node dist/server.js` | REST API + WebSocket chat, port 8080 |
| `thaala-api` | `node dist/worker.js` | Queue consumers: matching, notifications, media, payouts, deletion |
| `thaala-api` | `node dist/migrate.js` | One-off ECS task run by Jenkins before each deploy |
| `thaala-web` | `node server.js` | Next.js standalone server, port 3000 |

The api and worker share one image so the code they run is always the same version.

## Backend: modular monolith

Code in `apps/api/src/modules/<module>/` with `routes.ts → service.ts → repository.ts`.
Modules talk to each other through services or through events, never through another
module's repository.

Modules: `auth`, `profiles`, `media`, `repertoire`, `availability`, `enquiries`, `matching`,
`quotes`, `messaging`, `bookings`, `payments`, `reviews`, `notifications`, `privacy`
(export/deletion), `admin`, `audit`.

Cross-cutting middleware (in this order): request id → security headers → CORS allowlist →
body size limit → rate limiter → JWT verification → route-level auth policy → Zod
validation → handler → error mapper (no stack traces to clients).

## Web app as a BFF

The browser never holds Cognito tokens. Next.js route handlers do the OAuth/OTP exchange
and keep the tokens in `HttpOnly; Secure; SameSite=Lax` cookies, encrypted with a key from
Secrets Manager. Server components and route handlers call the API with the user's access
token. This keeps tokens away from XSS.

The mobile app talks to the API directly and stores tokens in Expo SecureStore.

## Core flow

1. Client posts an enquiry → `EnquiryCreated` event.
2. The matching worker filters musicians by service, district, availability and budget, then
   scores them (repertoire 30%, rating 25%, reply speed 20%, price fit 15%, profile 10%).
   The top 10–15 are stored as `enquiry_matches`.
3. The notification worker alerts each match: push → WhatsApp → SMS fallback.
4. A musician sends a quote → client notified.
5. Client and musician chat over WebSocket. Contact details are masked.
6. Client accepts → booking `pending_payment` → PayHere checkout for the 30% deposit
   (amount computed server-side).
7. PayHere webhook → signature, amount and order verified → ledger entry → booking
   `confirmed` → contact details unmasked.
8. Event date + 48 h with no dispute → `completed` → payout queued → review requested.

## State machines (only the service layer may change status)

- Enquiry: `open → quoted → booked | expired | cancelled`
- Quote: `sent → accepted | declined | expired | withdrawn`
- Booking: `pending_payment → confirmed → completed`, with `cancelled_by_client`,
  `cancelled_by_musician`, `disputed`
- Ledger (append-only): `deposit_received`, `balance_received`, `refund`, `platform_fee`,
  `payout_due`, `payout_sent`

## Key decisions

| Decision | Why |
|---|---|
| ECS Fargate, not Lambda | Docker images built and promoted by Jenkins; long-lived WebSocket connections |
| One API image for api/worker/migrate | No version drift between them |
| Postgres + pg_trgm for search | Enough at launch, and trigram matching works for Sinhala/Tamil titles |
| Cognito with a custom SMS sender | OTP SMS goes through Text.lk, which is far cheaper for Sri Lankan numbers |
| Deposit charged into the platform account, not card holds | PayHere card holds are credit-card only and expire before most events |
| Expo Push, not Amazon Pinpoint | Pinpoint reached end of support on 30 Oct 2026 |
