# User experience guidelines

The reference designs are the Magic Patterns prototype (web) and the Claude design canvas
(mobile). Match their layout, tokens and copy tone. Where a design and this file disagree,
this file wins on accessibility and states. Ask about everything else.

## Who we design for

- **Clients**: couples, families, event planners, companies, often on a mid-range Android
  phone on mobile data, sometimes booking from abroad. They want confidence: real videos,
  real reviews, clear prices.
- **Musicians**: busy and often on the road. They need to see an enquiry and quote in under
  a minute, mostly from WhatsApp notifications.

## Design tokens (keep in `packages/ui/tokens.ts` and the Tailwind theme)

| Token | Value | Use |
|---|---|---|
| `brand-600` | `#0F766E` | Client primary actions, links |
| `brand-700` | `#115E59` | Hover, pressed |
| `brand-50` | `#E6F4F2` | Selected backgrounds |
| `gig-600` | `#BE185D` | Musician mode primary |
| `gig-50` | `#FCE7F0` | Musician mode tints |
| `star` | `#F59E0B` | Rating stars only (decorative, never text) |
| Text | `#111827`, secondary `#4B5563` | Secondary text must be ≥ 4.5:1 on its background |
| Fonts | Space Grotesk (display), Inter (body), Noto Sans Sinhala, Noto Sans Tamil | Load only the weights used |
| Radius | 12 px inputs, 16 px cards, full for pills and buttons | |

Client mode is teal and musician mode is magenta, so users always know which mode they are in.

## Language and copy

- Three languages from day one: English (`en`), Sinhala (`si`), Tamil (`ta`). The
  language switcher is in the header and in onboarding. The choice is saved per user.
- Keys live in `packages/shared/i18n/{en,si,ta}.json`. Use ICU plurals. Never concatenate
  strings to build sentences (word order differs between languages).
- Sinhala and Tamil text runs longer and taller. Layouts must not clip. Test every screen in `si` and `ta`.
- Tone: warm, short, plain. "Post your event", not "Submit enquiry". Explain money and
  privacy rules where they happen ("Your phone number stays private until you book").
- Error messages say what happened and what to do next. Never show raw error codes.

## Formatting

- Money: `LKR 120,000` (no decimals for display, integer cents/paisa in storage). Use
  `formatLKR()` from `packages/shared`.
- Dates: `Sat, 13 Feb 2027`. Times: `7:00 pm`. Time zone always `Asia/Colombo`. Show the
  user's local time too if they are abroad.
- Phone: input with a fixed `+94` prefix and a country picker for diaspora users. Store E.164.
- Districts: the 25 districts of Sri Lanka as a fixed list in `packages/shared`.

## Every screen has four states

1. **Loading**: skeletons that match the layout, not spinners in the middle of the page.
2. **Empty**: explain why it is empty and give the next action ("No quotes yet. We've
   alerted 12 musicians…").
3. **Error**: a friendly message, a retry button, and the request id in small text for support.
4. **Offline / slow**: keep cached data visible, queue chat messages, show a banner.

## Forms

- Labels always visible (no placeholder-only fields). Inputs ≥ 44 px tall.
- Validate on blur and on submit, using the same Zod schema as the API (shared package).
- Keep entered data if submission fails. Long forms (enquiry) save drafts locally.
- The enquiry form asks only what matching needs, and marks optional fields as optional.

## Accessibility (WCAG 2.2 AA, required)

- Contrast ≥ 4.5:1 for text, 3:1 for large text and UI components.
- Touch targets ≥ 44 × 44 px. Focus visible on every interactive element.
- Real `<button>`, `<a>`, `<label>`. Icon-only buttons have `aria-label`. Decorative icons
  are `aria-hidden`.
- Screen-reader labels on ratings ("Rated 4.9 out of 5 from 38 reviews").
- Respect reduced motion and large text sizes (mobile dynamic type).
- Captions or transcripts are encouraged on musician videos.
- Playwright runs `@axe-core/playwright` on key pages in CI. New violations fail the build.

## Performance budget (enforced in CI where possible)

- Web: LCP < 2.5 s on Moto G-class over 4G, JS < 200 KB gzipped on public pages,
  images in WebP/AVIF with `next/image`, lazy-loaded below the fold.
- Mobile: cold start < 3 s on mid-range Android. Lists virtualised. Images resized on the
  server (thumbnails 320 px, cards 640 px, full 1280 px).
- Video: never autoplay on mobile data. Show a poster image and a play button.

## Trust and safety in the UI

- Show "Verified" only for vetted musicians. Explain what it means on tap.
- Reviews show "Verified booking" and the event type and month.
- Booking protection is explained at the quote, checkout and confirmation steps.
- Before booking, contact details in chat appear as "[hidden until booking]" with a short explanation.
- Destructive actions (cancel booking, delete account) need confirmation and explain the consequences (refund amount, data kept for legal reasons).

## Musician speed

- An enquiry notification deep-links straight to "Send quote", with the form prefilled
  from their packages.
- Show their average reply time and why it matters for ranking.
- Quote in three taps: package, adjust price, send.
