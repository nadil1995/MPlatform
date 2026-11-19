# User data handling

The platform serves users in Sri Lanka and is subject to Sri Lanka's **Personal Data
Protection Act No. 9 of 2022 (PDPA)**. Some users (the diaspora booking from the UK or EU)
may also bring **UK/EU GDPR** into play. **Get a legal review before launch.** This file sets
the engineering rules that support compliance. It is not legal advice.

## Principles

1. **Minimise**: collect only what a feature needs. Ask "what breaks if we don't store this?"
2. **Purpose-bound**: use data only for the purpose stated at collection.
3. **Visible**: the privacy notice and in-app copy say what we collect and why.
4. **Controllable**: users can see, correct, export and delete their data from settings.
5. **Protected**: encrypted in transit and at rest, access-logged, never in logs.

## Classification

| Class | Examples | Rules |
|---|---|---|
| **Public** | Musician stage name, bio, public photos/videos, repertoire, ratings | Shown to anyone. Musician controls it. |
| **Internal** | Enquiry details (date, district, guest range, budget), quote amounts | Visible only to the parties involved and admins. |
| **Personal (PII)** | Names, phone, email, event venue, chat messages | Owner + counterparty after booking + admins with a reason. Masked in chat before booking. Never logged. |
| **Sensitive** | Bank account details, ID verification result, payment references | Field-level encrypted (KMS envelope). Decrypt only in the payouts service, audited per read. |
| **Never store** | Card numbers, CVV, NIC/passport images, passwords, OTP codes in plain text | — |

ID verification: store only the **result** (`verified_at`, `verified_by`, method), not
images of identity documents. If a document must be seen, view it in a short-lived
session and do not keep it.

## Inventory and retention

Every PII column must appear here. A PR that adds one without updating this table fails review.

| Data | Where | Purpose | Retention |
|---|---|---|---|
| Phone number | `users.phone_e164` | Login (OTP), booking contact | Life of account, deleted on account deletion |
| Email | `users.email` | Receipts, notifications | Life of account |
| Display name | `users.display_name` | Shown to counterparty | Life of account |
| Event details | `enquiries` | Matching and quotes | 24 months after event date, then anonymised |
| Unsent enquiry draft | Browser `localStorage` (`thaala:enquiry-draft:v1`), web only | Keep a half-filled "Post your event" form | Until posted (cleared on submit) or the user clears site data. Never sent to us; holds no contact fields. Account deletion cannot reach it, so the privacy notice must mention it. |
| Chat messages | `messages` | Communication between parties | 24 months after the last booking or enquiry activity, then deleted |
| Bank details | `payout_accounts` (encrypted) | Paying musicians | Until changed or account deleted. Old values deleted on change. |
| Payment records | `payments`, `ledger_entries` | Accounting, tax, disputes | **7 years** (financial records). Personal fields anonymised on account deletion, amounts kept. |
| Reviews | `reviews` | Reputation | Kept after reviewer deletion but shown as "Former user" |
| Device push tokens | `devices` | Notifications | Removed on logout or after 90 days unused |
| Raw uploads | S3 `media-raw` | Processing only | Deleted 7 days after processing (lifecycle rule) |
| Application logs | CloudWatch | Debugging, security | 30 days (staging 14) |
| Audit log | `audit_log` + S3 archive | Security and accountability | 2 years |
| Backups | RDS snapshots | Recovery | 35 days prod. Deleted data falls out of backups within that window; say so in the privacy notice. |

Retention is enforced by scheduled worker jobs (`privacy` module), not by hand.

## Consent

- At sign-up: accept terms and privacy notice (timestamp and policy version stored in
  `consents`).
- Marketing messages (SMS, WhatsApp, email) are **separate, opt-in, unticked by default**.
  Transactional messages (OTP, booking updates) need no marketing consent.
- WhatsApp: only template messages the user can expect, with opt-out supported.
- Analytics: PostHog with IP anonymisation, no PII in event properties, and session recording
  off on forms.

## User rights (built into settings)

| Right | Feature | SLA |
|---|---|---|
| Access / portability | "Download my data": a worker builds a JSON + media ZIP, emailed as a 24-hour signed link | Within 72 h |
| Correction | Edit profile, phone change with OTP re-verification | Immediate |
| Deletion | "Delete my account": 14-day grace period, then hard delete or anonymise per the table above. Blocked while a booking is active or money is pending, with a clear explanation. | Done within 30 days |
| Withdraw consent | Marketing toggles in settings | Immediate |

Admins can action requests that arrive by email, through the same code paths, logged in the
audit log.

## Access by staff

- Admin views show PII only when needed for the task (support ticket, dispute), with a
  reason field. Every view of Sensitive data is audit-logged.
- No production database access from laptops. Break-glass access goes through SSM Session
  Manager with approval, and is logged.
- Staging uses **synthetic seed data only**, never a copy of production.

## Cross-border transfer

Data is hosted in AWS `ap-south-1` (India). The PDPA has rules on cross-border processing.
Legal review must confirm the transfer basis, and the privacy notice must disclose it.
Sub-processors (AWS, PayHere, Text.lk, Meta/WhatsApp, Expo, PostHog, Sentry) are listed in
the privacy notice.

## Breach response

1. Detect (alarms, GuardDuty, reports) → open an incident, assign an owner.
2. Contain: rotate credentials, revoke sessions, block the vector.
3. Assess: what data, how many users, what risk. Preserve logs.
4. Notify: the Data Protection Authority of Sri Lanka and affected users within the
   timelines the PDPA and its rules require (confirm the current deadlines with legal), and
   the ICO within 72 h if UK users are affected.
5. Post-incident review and a fix tracked in the backlog.

## Engineering checklist for any change touching PII

- [ ] Classified and added to the inventory table above with a retention rule
- [ ] Included in the export job and the deletion/anonymisation job
- [ ] Added to the logger redaction list
- [ ] Not sent to analytics, Sentry breadcrumbs or third parties unless listed as a sub-processor
- [ ] Visible only to the right parties (tests prove it)
