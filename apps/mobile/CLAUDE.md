# apps/mobile — CLAUDE.md

Expo (React Native) with Expo Router, TypeScript, TanStack Query, Zustand, React Hook Form
+ shared Zod schemas, i18next (en/si/ta), expo-notifications, expo-secure-store,
expo-image, the PayHere React Native SDK. Built and released with EAS.

## Layout

```
app/
  (auth)/          Phone OTP, Google/Apple sign-in, language choice, consents
  (client)/        Tabs: Discover, Enquiries, Messages, Bookings, Account
  (musician)/      Tabs: Enquiries, Messages, Calendar, Bookings, Profile
src/
  api/             Typed client generated from openapi.yaml; attaches token; refresh on 401
  auth/            SecureStore token storage, session state
  i18n/            Loads packages/shared/i18n
  components/      Screen pieces (match the Claude design canvas mockups)
  lib/             Formatters, deep-link parser, network status
```

## Rules

- One app with a mode switch (client teal, musician magenta). The mode is saved per user.
- Tokens are stored **only** in `expo-secure-store`. Never in AsyncStorage, MMKV or logs.
- `app.config.ts` reads only public values (`EXPO_PUBLIC_*`). Anything in the bundle is
  public, so no secrets.
- Deep links (`thaala://`, universal links): parse with a whitelist of routes and Zod-validate
  params. Never perform an action (accept, pay, delete) straight from a link without the user confirming.
- Payment screens set `FLAG_SECURE` on Android (`expo-screen-capture`).
- Uploads: compress on the device, then upload to the presigned URL from the API. Show
  progress and allow retry.
- Offline: TanStack Query persisted cache for read screens, queued chat messages with a
  visible "sending" state.
- Push: register the Expo push token after login, send it to `/v1/devices`, remove it on logout.
- Accessibility: `accessibilityLabel` on icon buttons, dynamic type supported, 44 pt targets.
- The app calls `/v1/config` at start. If the version is below `minSupportedVersion`, it
  shows a blocking update screen.
- Tests: Jest + React Native Testing Library for components. Maestro flows for the core journey.
