# Camp_Order_App

**CampOrder — campus needs, one place.** A portrait-first mobile marketplace and campus-services app for students in Ghana. It brings campus food, drinks, groceries, study supplies, personal-care goods, errands, and bookable services into one Expo app, with a persistent backend and GHS checkout flow.

> **Project status:** The managed Expo/React Native app and backend are implemented and run in the Manus Preview. Listings and providers currently supplied by the project are clearly marked as samples, not verified operating businesses. Paystack development mode is intended for checkout testing. This repository does not represent a live campus marketplace, a released App Store/Play Store build, or a production deployment.

## Contents

- [Product scope](#product-scope)
- [Architecture](#architecture)
- [Repository map](#repository-map)
- [Technology](#technology)
- [Run the app](#run-the-app)
- [Configuration and credentials](#configuration-and-credentials)
- [Database and sample data](#database-and-sample-data)
- [Authentication and security](#authentication-and-security)
- [Payments](#payments)
- [Campus services and fulfillment](#campus-services-and-fulfillment)
- [Expo Go and web Preview](#expo-go-and-web-preview)
- [Checks and tests](#checks-and-tests)
- [GitHub workflow](#github-workflow)
- [Operational limitations](#operational-limitations)
- [Design reference and project documents](#design-reference-and-project-documents)
- [License](#license)

## Product scope

CampOrder is designed around the selected Ghanaian campus and the practical tasks students need to handle during the day. The app includes:

- First-run onboarding, phone/password account creation, sign-in, SMS OTP verification, and campus selection.
- Home and Explore discovery with campus context, search, service shortcuts, vendor pages, and product details.
- Marketplace categories for Food, Drinks, Groceries, Food Ingredients, Cook-a-Meal bundles, Health & Personal Care, Stationery, Fashion, Electronics, and other campus needs.
- Persistent carts, checkout details, a hosted Paystack payment handoff, payment-return verification, order history, and backend-derived order status.
- Campus-service browsing, personal errand submission and tracking, and service booking flows for printing and binding, laundry, parcel pickup and delivery, room cleaning, repairs and tech help, and barber/beauty services.
- A Ghana Cedi presentation layer backed by integer pesewas for stored prices and transaction amounts.

Sample listings, vendors, campuses, and service types carry sample flags and are identified in the UI. Seeded vendor ratings, estimates, prices, descriptions, and inventory should not be interpreted as verified commercial information.

## Architecture

```mermaid
flowchart LR
  Student[Student] --> App[Expo Router mobile app / Expo Web]
  App -->|typed tRPC over HTTP| API[Express API :3000]
  API --> DB[(Managed MySQL)]
  API -->|OTP send| SMS[Africa's Talking]
  API -->|initialize and verify GHS transaction| Paystack[Paystack]
  Paystack -->|signed event| Hook[/POST /api/payments/paystack/webhook/]
  Hook --> API
  API --> Storage[Managed project image storage]
```

The React Native client owns presentation, navigation, input collection, and temporary query/cache state. Express and tRPC own authentication checks, input validation, pricing, persistence, payment initiation and verification, and request ownership checks. Drizzle defines the MySQL schema and typed query layer. The server is authoritative for whether an order is paid; a browser return by itself does not establish payment success.

The Expo Web/Metro listener uses port **8081**. The API uses port **3000** and exposes `GET /api/health` plus the typed tRPC endpoint under `/api/trpc`. Paystack's webhook endpoint is `POST /api/payments/paystack/webhook`; it verifies the signature against the raw request body and records provider events idempotently.

### Main domain records

The Drizzle schema retains the starter `users` table and adds CampOrder data for OTP challenges, campuses, vendors, products, carts and cart items, orders and order items, campus services, errands, service bookings, payments, and processed payment-webhook events. Order/payment/service state is stored server-side so the client can display the current record after navigating away or signing in again.

### Request flow examples

1. **Signup/sign-in:** The app submits a phone number and password to a public auth mutation. The API normalizes the phone, validates credentials, persists a challenge, and asks the SMS provider to send the OTP. OTP verification consumes the challenge and issues a session. Native clients receive a bearer session for secure device storage; web Preview uses an HTTP-only cookie.
2. **Checkout:** The authenticated API reads the user's active cart and current product prices, calculates the total in pesewas, writes a pending order and payment reference, and asks Paystack to initialize a GHS transaction. The app opens the hosted authorization URL. On return, it requests server-side verification. A valid signed Paystack webhook is also processed idempotently.
3. **Errand or service booking:** The authenticated API validates the campus/service, creates an owned database record, and returns its actual saved status. Requests wait for a campus provider; the app does not invent a provider acceptance.

## Repository map

| Path | Responsibility |
| --- | --- |
| `app/index.tsx`, `app/onboarding.tsx` | First-run entry and onboarding. |
| `app/(auth)/` | Phone/password sign-in and signup, OTP verification, and campus selection. |
| `app/(tabs)/` | Home, Explore, Orders, Profile, and the primary tab navigation. |
| `app/(commerce)/` | Cart, checkout, Paystack return, product/vendor details, and order status. |
| `app/(services)/` | Service catalogue, errand submission/tracking, bookings, and request history. |
| `components/camporder/` | Reusable CampOrder controls and visual components. |
| `hooks/`, `lib/camporder/`, `lib/trpc.ts` | Auth/campus hooks, formatting, asset paths, typed API client, and client utilities. |
| `server/_core/` | Express startup, API context, cookies/CORS, auth routes, and Paystack webhook. |
| `server/routers/`, `server/routers.ts` | Typed auth, catalog, cart, order, payment, and service APIs. |
| `server/services/` | Phone authentication/security and Africa's Talking/Paystack adapters. |
| `server/db.ts` | Managed MySQL connection and user persistence helpers. |
| `drizzle/schema.ts`, `drizzle/*.sql`, `drizzle/meta/` | Database schema, checked-in migrations, and migration journal/snapshots. |
| `server/seed.ts` | Idempotent insertion of clearly identified sample records. |
| `tests/` | Isolated auth/security, provider-adapter, CORS, and payment checks. |
| `assets/images/` | App icons, splash assets, and bundled visual assets. |

## Technology

- **Mobile and web:** Expo SDK 57, Expo Router, React Native 0.86, React 19, TypeScript, NativeWind/Tailwind, React Query, and tRPC 11.
- **Backend:** Node.js, Express 4, tRPC 11, Zod validation, Drizzle ORM, and MySQL (`mysql2`).
- **Authentication:** Node `scrypt`, cryptographic OTP generation/hashing, signed JWT sessions with `jose`, native Expo SecureStore, and secure web cookies.
- **Payments/SMS:** Paystack transaction API and webhooks; Africa's Talking outbound SMS API.
- **Toolchain:** The project declares `pnpm@9.12.0`; Node.js 22.x is the validated runtime baseline. Follow the lockfile rather than upgrading dependencies ad hoc.

## Run the app

### Managed project / Preview

The project is initialized for Manus Mobile Dev. In the project directory, install from the checked-in lockfile and start the two listeners:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` runs the API on port `3000` and Expo Metro/Web on port `8081`. In the managed environment, the database connection, runtime URLs, and any provider credentials must be supplied through the project's protected configuration. Do not put those values in source code or commit a local environment file.

### Local development

A local run needs Node.js, pnpm, and a reachable MySQL database. Provide the values listed under [Configuration and credentials](#configuration-and-credentials) through your local environment manager or an ignored `.env` file. The server reads `DATABASE_URL`; Drizzle commands use the same variable. The session-signing secret must be at least 32 characters. To run the API and Metro separately, use `pnpm dev:server` and `pnpm dev:metro` in separate terminals. The checked-in `dev:metro` script serves Expo Web on port `8081`; use the project's Expo Go connection instructions for device access.

The current Manus Preview host and Expo Go QR/deep link are session/runtime-specific. Use the current **Connect Expo** information in the project dashboard; do not copy a temporary hostname into application source or this README.

## Configuration and credentials

Set credentials in the managed project's protected environment or a local secret manager. The following names describe the server/runtime contract; **never commit their values**.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | MySQL connection used by the API and Drizzle Kit. |
| `CAMPORDER_SESSION_SECRET` or `MANUS_JWT_SECRET` | HMAC signing key for CampOrder session and OTP hashes; configure a secret of at least 32 characters. The managed project may provide `MANUS_JWT_SECRET`. |
| `AFRICASTALKING_USERNAME` | Africa's Talking account username. |
| `AFRICASTALKING_API_KEY` | Server-only credential for sending OTP messages. |
| `AFRICASTALKING_SENDER_ID` | Sender ID configured/approved for the provider and destination market. |
| `PAYSTACK_SECRET_KEY` | Server-only Paystack key. Development rejects anything except an `sk_test_` key; production mode requires an `sk_live_` key. |
| `AFRICASTALKING_API_URL` | Optional provider endpoint override; defaults to Africa's Talking's documented send endpoint. |
| `EXPO_PUBLIC_API_BASE_URL` | Optional explicit public API origin for the mobile client. Prefer managed runtime configuration in Manus. |
| `EXPO_WEB_PREVIEW_URL`, `EXPO_PACKAGER_PROXY_URL` | Runtime origins used by the managed Preview/client configuration. Do not hardcode temporary values. |

Keep `.env`, `.env.*`, and all real credentials out of commits. `.env.example` may contain names and empty placeholders only. Never paste credentials into issues, chat, README examples, Git remotes, or shell commands that are retained in history. Provider API keys must remain on the server; they must never be exposed in the Expo bundle.

## Database and sample data

The schema is in `drizzle/schema.ts`; migrations are checked in under `drizzle/`. `drizzle.config.ts` requires `DATABASE_URL`. To apply migrations to a database you intentionally selected:

```bash
pnpm exec drizzle-kit migrate
```

The convenience script `pnpm db:push` runs schema generation and migration. Review generated SQL before applying schema changes. The sample seeder is:

```bash
pnpm exec tsx server/seed.ts
```

It inserts missing records for six Ghana campus options, sample campus vendors/products, and service types; it leaves existing records unchanged. It still performs database writes.

> **Managed database warning:** Development and published app environments can share the managed project database. Schema changes, seed runs, updates, and deletions may affect shared data. Confirm the selected database before running commands; avoid destructive schema changes and never use production customer data for tests.

Prices are integer pesewas in storage (`pricePesewas`, `totalPesewas`, etc.) and formatted as GHS at the UI boundary. This avoids floating-point arithmetic for checkout totals.

## Authentication and security

- Phone numbers are normalized to international format; Ghana national numbers are converted to `+233…`.
- Passwords are stored as salted `scrypt` hashes, not plaintext. Password length is validated at signup; repeated failed password attempts trigger a temporary lockout.
- OTPs are cryptographically generated six-digit codes. The database stores a keyed hash rather than the code. Challenges expire after five minutes, are one-use, limit verification attempts, apply per-phone request limits, and require a high-entropy resend capability with a cooldown.
- The SMS provider's acceptance/queue response is not proof that a handset received a text. Do not log or return an OTP from production code.
- Session JWTs are signed and expire after 14 days. Native token storage uses Expo SecureStore. Web sessions use an HTTP-only cookie; the cookie is marked `Secure` and cross-site compatible when the public request is HTTPS.
- Protected procedures scope cart, order, errand, booking, and payment lookups to the authenticated account. Checkout amounts are calculated from the database, not trusted from the client.
- Tests use provider mocks. Do not run signup/login tests with live SMS credentials unless you intend to send real SMS messages.

## Payments

The server initializes Paystack transactions with `currency: GHS` and an integer amount in pesewas. The app opens the hosted authorization URL; the server verifies the reference, amount, and currency before moving the order to paid/placed. The webhook at `/api/payments/paystack/webhook` checks `x-paystack-signature` against the raw request body, validates the matching reference/amount/currency/status, and records processed events to prevent duplicate fulfillment updates.

Development checkout is test-only and refuses live keys. No live payment should be initiated from development. A production deployment requires a protected Paystack live key, configured public runtime URLs, HTTPS webhook registration in Paystack, and an operational review. Payment testing in this repo is mocked; automated tests do not charge cards.

## Campus services and fulfillment

Errands and bookings are durable customer requests, not dispatch assignments. New requests have pending states such as `submitted` or `pending_confirmation`; no seeded provider is automatically shown as having accepted. The current code does not implement a vendor/runner operations dashboard, merchant payouts, real-time courier GPS, or a verified provider network. Build and verify those business/operations integrations before promising service availability to students.

The seeded campuses, sellers, prices, ratings, estimated times, product descriptions, and service options are sample/demo content. Replace them with owner-approved, accurate business data and obtain vendor consent before operating a marketplace.

## Expo Go and web Preview

For the managed Expo Go preview:

1. Connect the Expo account/credential using the project dashboard's secure **Connect Expo** flow; do not put an Expo token in source code or messages.
2. Ensure the app's Preview/Metro service is running on the configured port (`8081`) and the API is healthy on `3000`.
3. Scan the current dashboard-generated QR code in Expo Go, signed in to the corresponding Expo account. The QR/deep link depends on the active runtime and may change; it is not a permanent public URL.

The browser Preview is served through the managed Preview origin. It is separate from the Expo Go deep link. A successful local HTTP health response does not by itself prove that a mobile device has connected; test on a device using the current QR when device testing is required.

## Checks and tests

Run from the repository root:

```bash
pnpm check   # TypeScript, no emit
pnpm lint    # Expo ESLint configuration
pnpm test    # Vitest suite
pnpm build   # Bundle the Express/tRPC API into dist/
```

The test suite covers auth session/logout compatibility, phone/password/OTP primitives, Paystack request/signature behavior, mocked SMS interactions, and CORS. `pnpm build` builds the backend; it does **not** create an Android APK, iOS IPA, or app-store release. No application-store artifact is included in this repository.

## GitHub workflow

The public source repository is [`EricKirikou/Camp_Order_App`](https://github.com/EricKirikou/Camp_Order_App). GitHub authentication is provided by the authorized GitHub CLI/integration in the development environment. For a fresh workstation, authenticate with GitHub CLI interactively, then configure Git to use that CLI credential helper:

```bash
gh auth login
gh auth setup-git --hostname github.com
gh repo clone EricKirikou/Camp_Order_App
```

Do not place an access token in a remote URL, commit, README, or `.env` file. Do not force-push `main`; fetch and integrate changes before pushing. The Manus project has its own managed canonical Git remote named `origin`; in that environment, do not repoint `origin` to GitHub. The GitHub repo is a separate source copy/export and should be updated through an explicit GitHub push after preserving the target's existing README/design-document history.

A normal GitHub clone can use standard feature branches and pull requests. Before contributing, run `pnpm check`, `pnpm lint`, and `pnpm test`, review the staged diff, and confirm that no credentials or local environment files are staged.

## Operational limitations

- No verified vendor, delivery partner, or provider network is supplied; sample content is visibly marked.
- SMS delivery depends on correctly configured Africa's Talking account details and a permitted sender ID. Provider acceptance is not handset delivery confirmation.
- Development uses Paystack test mode. Live payment activation is a separate production configuration and operations task.
- Errand/service requests are saved and trackable, but remain pending until an actual campus provider workflow is supplied.
- The project has not been published from this repository and has no store-ready native build.
- Catalog images currently use the managed project's `/manus-storage/` asset route. For deployment outside Manus, move or mirror those assets to a storage origin available to that deployment and update the image paths.

## Design reference and project documents

- [CampOrder Figma design](https://www.figma.com/design/O3Ys7gRu8moY4qgctso7CH/Untitled?node-id=0-1)
- [Architecture and ERD PDF](Camp_Order_App_ERD_Architecture_Black_White.pdf)
- [CampOrder UI PDF](<Camporder ui/Camp Orderd.pdf>)

The app follows the supplied forest-green, warm-ivory, campus-first design direction. The design source is a reference; implementation details and available flows are defined by the code in this repository.

## License

No `LICENSE` file is currently included. All rights remain with the project owner unless a license is added; do not assume the source or supplied design assets may be redistributed or reused under an open-source license.
