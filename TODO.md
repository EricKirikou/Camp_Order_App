# CampOrder implementation ToDo

## [ ] Account access — phone, password, and SMS OTP
- Implement the approved Ghana-focused account flow using phone number + password and SMS OTP with Africa’s Talking as the selected outbound SMS provider.
- Support sign-up, sign-in, OTP verification/resend and logout, with secure password hashes, expiring/one-use OTP challenges, rate limits, and server-verified sessions.
- Keep provider credentials out of the client, source files, and chat; use protected credential setup. Do not claim an SMS was delivered when the provider only accepted the request.

## [ ] Ghana marketplace, GHS checkout, orders, and Paystack
- Use Ghana Cedi (GHS) for all user-visible marketplace/order amounts and pesewas for persistent/API minor-unit values.
- Provide persistent campus/vendor/category/product, cart, order, and order-line data, and connect catalog selection, quantity updates, delivery details, checkout, payment return, confirmation, live status/timeline, orders list, and profile to the backend.
- Integrate Paystack server-side for GHS payments: calculate price on the server, initialize the transaction, store its reference, verify payment before marking it paid, validate signed webhook events, and apply payment/order transitions idempotently.
- Use Paystack test mode for development and never make a real charge during development or validation. Seed content must be visibly sample/demo data; do not present unverified vendors/services as real.

## [ ] Campus errands and service bookings
- Persist personal errands, quotes/review, status tracking, and campus-service booking details and statuses in the backend.
- Implement and connect the Figma flows for Campus Services, Personal Errands, Create an Errand, Errand Review & Quote, Errand Tracking, Printing & Binding, Laundry Booking, Parcel Pickup & Delivery, Room Cleaning Booking, Repairs & Tech Help, and Barber & Beauty Booking.
- Present seeded options as sample content rather than verified live availability; do not claim an external vendor, courier or runner accepted a request unless backend data records that transition.

## [ ] Figma-matched mobile experience and navigation
- Recreate the supplied CampOrder Figma design in the initialized portrait-first Expo/React Native app with the app branding, campus selection for Ghanaian universities, responsive forms, product/service discovery, clear order/service states, and persistent bottom navigation.
- Make the screens navigable and interactive, not a static mockup.
- Implement the Figma screen set: 01 Splash, 02 Onboarding, 03 Login, 04 Sign Up, 05 OTP Verification, 06 Campus Selection, 07 Home, 08 Explore, 09 Vendor, 10 Product Details, 11 Cart, 12 Checkout, 13 Payment, 14 Order Confirmation, 15 Live Tracking, 16 Orders, and 17 Profile.
- Implement Figma categories and flows for Food, Drinks, Groceries, Food Ingredients, Ingredient Details, Cook-a-Meal Bundle, Health & Personal Care, Stationery, Fashion, Electronics, More · All Campus Needs, and the campus-services/errands screens listed above.

## [ ] Verification and handoff
- Run registered TypeScript diagnostics, focused tests, database schema setup for additive migrations, and the initialized project’s Expo Preview; fix confirmed implementation errors and confirm the app renders and representative flows work.
- Do not publish the app or claim Android/iOS release builds. Keep provider calls mocked during checks, use only Paystack test mode for payment validation, and do not send live SMS or make any real charge during the agent’s validation.
- Report prerequisites honestly: protected Africa’s Talking credentials and registered Ghana sender ID, Paystack test credentials if needed, and verified real vendor/fulfillment data are not inferred from demo seeds.
