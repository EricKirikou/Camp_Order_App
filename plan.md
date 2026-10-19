# CampOrder Mobile — Implementation Plan

## Approved scope and integration choices

Build on the already initialized managed Expo Router / React Native / TypeScript project and its managed MySQL database. Recreate and connect the CampOrder Figma experience at `https://www.figma.com/design/O3Ys7gRu8moY4qgctso7CH/Untitled?node-id=0-1&m=dev&t=fvgzmnVyPhIH6Ez1-1` as a portrait-first campus marketplace and services app for Ghana. The approved business scope is the full backend: phone + password accounts with SMS OTP, Ghana Cedi pricing, persistent campus/vendor/catalog/cart/order/booking data, and Paystack checkout. The user selected Africa’s Talking for outbound OTP SMS after PvaCodes was verified unsuitable; PvaCodes is a virtual-number/incoming-SMS service, not an outbound OTP sender.

Paystack will be wired server-side for GHS transactions. Development and validation use Paystack test credentials only; do not initiate a live charge. Paystack’s API uses GHS pesewas (integer minor units), requires an email for transaction initialization, and uses test/live credentials to select the environment. Collect the development test key via protected project input; do not request a live key. Africa’s Talking credentials and its Ghana sender ID are account-dependent, so collect them through protected project setup, never chat. Its documented live SMS send route requires `username`, `phoneNumbers`, `message`, and a registered `senderId`; the Ghana help center says sender ID registration is free, limited to 11 characters, and requires a company website and sample message. No SMS or payment-provider call will be made during implementation checks. Tests will mock both providers. Africa’s Talking may reject a live send until its Ghana sender ID is registered/approved; keep that separate from the app’s account-verification state. Provider API acceptance is not final SMS delivery confirmation.

Seed data is clearly labeled as sample/demo campus content and is not presented as verified real vendor inventory, service availability, or fulfillment. Orders, errands, and bookings are persisted with honest statuses, but no merchant payout, courier dispatch, or operational vendor network has been specified or is claimed. A valid email must be collected for Paystack at checkout if the account has none. Do not publish the app or claim an Android/iOS release build.

## Implementation approach

Keep the fixed Expo / React Native / NativeWind / Express / tRPC / Drizzle stack; do not replace or regenerate the initialized starter. Use Expo Router for the auth and main app routes, reusable React Native components for cards/forms/headers/navigation, and typed tRPC procedures for application data. Use the existing managed MySQL database with deterministic additive migrations. Do not erase existing user data or run destructive DDL. Persist sample records idempotently and never overwrite later user edits.

Extend the user model with normalized Ghana/international phone, a salted password hash, verification state, and last-login data. OTP challenges store only a one-way/HMAC hash, purpose, expiry, attempt count, and consumed timestamp; generate six-digit codes with a cryptographic RNG, enforce cooldown/rate limits and one-minute resend controls, use a 256-bit resend capability, avoid account enumeration, and never log the OTP or password. Hash passwords with Node’s built-in scrypt and compare safely; lock account password attempts after five failures for 15 minutes. Issue short-lived signed application sessions; native clients store bearer sessions in Expo SecureStore, while web Preview uses an HTTP-only `Secure; SameSite=None` cookie when reached over public HTTPS. Authorize user-owned cart/order/service records on the server.

Model CampOrder’s marketplace entities in Drizzle: campuses, vendors, categories, products, cart items, orders/order lines, campus services, errands/bookings, payments, OTP challenges, and idempotent webhook events. Represent money as integer pesewas in storage and convert/format at the UI boundary. The server computes checkout totals from persisted catalog/cart data; it does not trust client-submitted amounts. Paystack secret keys remain server-only. The backend initializes a GHS payment, stores the reference, verifies the transaction before confirming payment, and also processes verified Paystack events. Capture the exact raw webhook body, validate `x-paystack-signature` with HMAC-SHA512 before updates, make updates idempotent, and acknowledge promptly.

The Expo client provides coherent screen-to-screen flows for account setup, campus selection, shopping, cart and checkout, payment return, order status, errands and campus-service bookings. Paystack requires a customer email; collect it at checkout when it is not already available. For mobile checkout, open Paystack’s authorization URL in the system browser and refresh the order from the backend on return/resume; the web Preview uses the returned callback route. All service/order records are backend-owned; UI state is only a temporary presentation cache.

### Project structure

- `app/index.tsx`, `app/onboarding.tsx`, and `app/(auth)/`: first-run onboarding, phone/password sign-in, sign-up, OTP verification, and campus selection routes.
- `app/(tabs)/`: Home, Explore, Orders, and Profile, with the persistent CampOrder tab bar.
- `app/(commerce)/` and `app/(services)/`: vendor/product/category/cart/checkout/payment/order tracking and errands/booking routes.
- `components/camporder/`: design-system primitives, forms, category tiles, catalog cards, status timelines, and reusable service cards.
- `assets/images/`: branded app icon, splash/favicon/native icon variants, and original CampOrder food/campus imagery.
- `hooks/` and `lib/`: session state, query helpers, currency/phone formatting, and provider-safe client requests.
- `server/services/`, `server/routers/`, and `server/routers.ts`: password/OTP/session logic, Africa’s Talking and Paystack adapters, ownership checks, and domain APIs.
- `server/db.ts`, `drizzle/schema.ts`, and `drizzle/`: typed queries, additive schema, and migrations for durable commerce and booking data.
- `tests/`: isolated unit coverage for security-sensitive utilities, order math, payment verification, and provider requests using mocks.

## Design direction

### Design movement and core principles

Use a contemporary Ghanaian campus-marketplace storefront: bright, compact, friendly commerce design rather than a generic delivery dashboard. Preserve the supplied Figma’s forest-green branding, light warm surfaces, rounded white cards, compact catalog imagery, expressive food photography, clear campus/location context, and approachable bottom navigation.

1. Make campus context immediately legible: campus/delivery location stays near the top and is easy to change.
2. Keep commerce scannable: short labels, useful prices/ratings/ETA, clear sections and strong primary actions.
3. Treat errands and services as first-class campus needs alongside food, not as an unrelated utility.
4. Be candid and reassuring: sample listings are labeled as samples, and payment/order states reflect confirmed backend state.

### Color philosophy and layout paradigm

Use **CampOrder Forest** (`#0D7048`) as the ownable brand color: an energetic, trustworthy green rooted in the Figma mark and campus life. Pair it with warm ivory (`#FFFDF8`) for open page backgrounds, ink (`#18231D`) for readable type, quiet sage (`#E9F1EB`) for secondary panels, and restrained mango/coral (`#F4A34F`) for deals and pending states. Avoid heavy gradients or decorative glass effects.

Use a one-handed, vertical discovery layout with sticky/persistent bottom navigation, compact horizontal category rails, and wide editorial feature cards; avoid a dense desktop-like grid. Product lists can become two-column only where the portrait device width allows it. Search and category filters stay close to content. Forms use large touch targets and stay above the keyboard.

### Signature elements and interactions

Repeat three motifs: (1) a campus gate/cart-path emblem in the CampOrder crest; (2) location pills showing campus/hostel context; and (3) sage-tinted status chips for order, errand, and booking timelines. Favor haptic confirmation, immediate cart feedback, inline validation, retryable payment/OTP states, and clear progress over modal-heavy flows. No silent fake success for SMS, payment, order acceptance, or booking.

### Animation and typography

Use light, fast transitions: 140–200 ms for selection, cart quantity and tab feedback; 180–240 ms for sheet/detail transitions; fade/slide only when it clarifies a state change. Respect reduced motion and avoid animation that delays checkout or verification. Use an Inter-style system sans throughout, with a deliberate hierarchy: 28–32 px bold discovery titles, 20–22 px section headings, 16 px medium item titles, and 12–14 px labels/supporting metadata. Use tabular numerals for prices/timers where supported; keep body copy at comfortable contrast and size.

### Brand essence, voice, and mark

**Positioning:** the campus marketplace that brings food, essentials, errands and useful services to Ghanaian students in one place. Personality: **resourceful, warm, dependable**. Headlines are direct and locally grounded; calls to action describe the next step, not vague promises. Example lines: **“Campus, sorted.”** and **“Your campus needs, on the way.”**

Build a distinctive two-part wordmark: a custom campus-gate/cart-path emblem plus “CampOrder” typeset as a joined, weight-contrasted logotype. Keep icon files free of baked-in rounded corners; the app’s image/card shapes add rounding in the UI, not the launcher artwork. The signature brand color remains CampOrder Forest (`#0D7048`).

## Delivery workflow and boundaries

Implement UI and backend together, then run the existing TypeScript diagnostics, focused tests, a database migration/sync, and the app’s Expo Web Preview to exercise representative shopping/auth/service flows. Use mock provider calls for automated checks and Paystack test credentials only if configured. Do not test by sending a live SMS, charging a customer, publishing the project, or claiming native build artifacts. Keep unresolved account-specific prerequisites explicit: Africa’s Talking username/API key and registered Ghana sender ID, plus the Paystack development test secret, all entered only via protected setup; real vendor/runner operations require the owner’s own verified business data and fulfillment network.
