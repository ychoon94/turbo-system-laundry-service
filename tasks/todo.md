# Task Checklist

## Current Task

- [completed] Implement phase 2 customer checkout productionization: real Stripe checkout/webhook flow, durable slot reservations, customer payment history, doc refresh, and verification.

## Steps

- [completed] Re-check the current repo shape, env surface, and phase-1 behavior against the requested plan.
- [completed] Update shared domain/schema/env scaffolding for Stripe-backed checkout and explicit slot reservations.
- [completed] Implement backend Stripe action, webhook processing, reservation release, and scheduled hold cleanup.
- [completed] Update customer UI/routes for hosted checkout redirects, payment-state return handling, and a payments history screen.
- [completed] Refresh docs to match the shipped phase-2 scope and environment requirements.
- [completed] Regenerate Convex types and run verification: lint, tests, build, and feasible e2e coverage.

## Acceptance Criteria

- Stripe checkout sessions are created server-side and payment success is finalized only by webhook processing.
- `timeSlots` store explicit `reservedLoads`, and expired or failed unpaid orders release both reservations.
- Customers can view payment status/history in the app without using a frontend mutation to mark payment complete.
- Existing auth/customer routes keep working, and the new phase-2 paths are covered by automated checks where feasible.

## Results

- Replaced the mock payment flow with a Stripe-backed checkout action, Stripe webhook route, webhook-driven order confirmation, and payment history query.
- Added explicit `reservedLoads` handling for time slots, timed-hold cleanup, and a cron-based safety net for stale unpaid reservations.
- Updated the customer UI to use hosted checkout redirects, a Stripe-aware order detail page, a `/customer/payments` route, and development-only router devtools loading.
- Refreshed `README.md`, `.env.example`, and `docs/phase-1-implementation-notes.md` to reflect the current phase-2 checkout scope and environment needs.
- Verification passed with `npm run codegen`, `npm test`, `npm run lint`, `npm run build`, `npx convex dev --once`, and `npm run test:e2e`.

## Current Task

- [completed] Inspect the repo for files likely to change when replacing mock checkout with real Stripe checkout and adding customer payment history, with emphasis on frontend routes/pages/components, env docs, tests, and docs.

## Steps

- [completed] Inventory frontend routes, pages, shared UI components, env handling, tests, and payment-related Convex modules.
- [completed] Trace the current checkout path from order creation to order detail and identify where mock checkout state is encoded.
- [completed] Cross-check the implemented payment flow against docs that already describe Stripe Checkout, webhook confirmation, and payment history.
- [completed] Produce a concise impact map with file paths and why each file matters.

## Acceptance Criteria

- The impact map distinguishes definite update targets from likely new files.
- Each item is backed by observed code or docs, not speculation alone.
- Frontend, env/docs, tests, and architecture/docs coverage is included.

## Results

- The current customer flow is `createDraftOrder -> payments.createCheckoutSession -> /customer/orders/$orderId?checkout=... -> payments.completeMockCheckout`.
- There is no customer payment-history route or page yet, and the customer shell only exposes Orders, New Order, and Profile.
- Frontend env handling only knows Clerk + Convex keys; Stripe-related variables are absent from `.env.example`, `src/lib/env.ts`, and `src/vite-env.d.ts`.
- The docs already promise Stripe Checkout, webhook confirmation, and payment history, so several documentation files will need alignment once the real integration lands.

## Current Task

- [completed] Set up a local Stripe webhook listener, verify live webhook delivery into Convex, and harden the checkout flow based on live test findings.

## Steps

- [completed] Install Stripe CLI locally and forward test-mode events to the Convex `/webhooks/stripe` endpoint.
- [completed] Capture the listener signing secret and sync `STRIPE_WEBHOOK_SECRET` into the active Convex deployment.
- [completed] Fix the live checkout edge cases found during testing: reuse open Stripe sessions, refresh stale holds before new session creation, and keep Stripe return URLs unescaped so Checkout can substitute the session id.
- [completed] Re-run verification and complete a real Stripe test payment through the hosted Checkout page while the local listener is active.

## Acceptance Criteria

- A local Stripe CLI listener can forward events to the Convex webhook route with HTTP `200` responses.
- Completing a real Stripe test payment moves the order from `awaiting_payment` to `awaiting_dropoff` by webhook, not by return URL logic.
- Reopening Checkout on an existing pending order does not fail because of an already-aging hold window.
- Stripe success/cancel redirects preserve the real checkout session id placeholder for substitution.

## Results

- Installed Stripe CLI with `winget`, started a listener against `https://optimistic-cormorant-710.convex.site/webhooks/stripe`, and synced the emitted `STRIPE_WEBHOOK_SECRET` into Convex.
- Verified a real hosted Checkout payment with test card `4242 4242 4242 4242`; the listener received `checkout.session.completed` and forwarded it to Convex with HTTP `200`, and the order detail page transitioned to `awaiting_dropoff`.
- Hardened `paymentsNode.createStripeCheckoutSession` so it reuses open Stripe sessions and refreshes the hold window before creating a new session, avoiding Stripe's minimum `expires_at` rejection during resumed checkout.
- Fixed checkout return URL generation so Stripe can replace `{CHECKOUT_SESSION_ID}` instead of receiving an encoded `%7B...%7D` placeholder.

## Current Task

- [completed] Add focused mutation-level webhook guardrail tests and a gated Stripe retry E2E scenario without regressing existing checks.

## Steps

- [completed] Add `src/test/payment-webhook-guardrails.test.ts` covering retry-safe `recordPaymentIntentFailure`, duplicate-event idempotency, and terminal `markCheckoutSessionExpired` cancellation + slot release.
- [completed] Add `e2e/stripe-retry-flow.spec.ts` for live Stripe retry-after-failure then success, gated by `PLAYWRIGHT_ENABLE_STRIPE_RETRY_E2E`, `PLAYWRIGHT_PENDING_ORDER_ID`, and credential env vars.
- [completed] Fix lint-safe mutation handler typing in the new unit suite.
- [completed] Re-run validations: targeted tests, full `npm test`, `npm run lint`, and `npm run build`.

## Acceptance Criteria

- New mutation-level tests assert no premature order cancellation or slot release on `payment_intent.payment_failed`.
- Terminal checkout expiry path remains covered with explicit slot-release assertions.
- New retry E2E scenario is present but does not destabilize default runs when live Stripe env is absent.
- Existing repo validation remains green after test additions.

## Results

- Added `src/test/payment-webhook-guardrails.test.ts` with 3 focused guardrail cases and deterministic mocked Convex DB interactions.
- Added `e2e/stripe-retry-flow.spec.ts` to exercise declined-card retry then successful payment in hosted Stripe Checkout under explicit env gating.
- Confirmed validation status after implementation: `npm run lint` passed, `npm test` passed (19 tests), and `npm run build` passed.

## Current Task

- [completed] Patch the remaining late-webhook state-machine gaps after review and rerun verification.

## Steps

- [completed] Prevent a late `checkout.session.completed` from reopening an order that was already terminally cancelled.
- [completed] Preserve terminal failed payment state when a later `payment_intent.payment_failed` arrives after cancellation.
- [completed] Extend the mutation-level webhook guardrail tests to cover both late-event cases.
- [completed] Re-run verification with `npm test`, `npm run build`, and `npx convex dev --once`.

## Acceptance Criteria

- A late success webhook cannot move a cancelled order back to `awaiting_dropoff`.
- A late failed-payment webhook cannot flip a cancelled payment record from `failed` back to `pending`.
- The retryable first-failure behavior for active `awaiting_payment` orders remains intact.

## Results

- `markCheckoutSessionCompleted` now exits before mutating order state when the order is already terminally cancelled, while still recording the payment as paid.
- `recordPaymentIntentFailure` now preserves terminal payment state for cancelled or failed orders instead of reopening the payment record as pending.
- `src/test/payment-webhook-guardrails.test.ts` now covers both late-success and late-failure terminal-state scenarios.
- Verification passed with `npm test`, `npm run build`, and `npx convex dev --once`.

## Current Task

- [completed] Revert checkout to first-failure cancellation, add automatic refund for late success on cancelled orders, and add prefilled reorder flow.

## Steps

- [completed] Update payment/order schema and webhook handling for terminal first-failure cancellation, refunded state, and refund metadata.
- [completed] Add backend reorder-defaults query and any supporting helpers needed for prefilled reorder.
- [completed] Update customer order detail, payments, and new-order routes/pages for refunded states and reorder-from-failed-order flow.
- [completed] Replace retry-oriented tests with cancellation/refund/reorder coverage and update gated Stripe E2E.
- [completed] Run verification and feasible live Stripe checks against the new behavior.

## Acceptance Criteria

- The first `payment_intent.payment_failed` cancels the order, releases slots, and leaves the order ready for reorder rather than in-session retry.
- A late success webhook on a cancelled order triggers automatic refund and records a `refunded` payment outcome without reopening fulfillment.
- Failed or refunded orders expose a reorder path that prefills the new-order form and reuses original slots when still available.
- Automated checks and feasible live Stripe verification pass for the revised flow.

## Results

- Reverted the first failed `payment_intent.payment_failed` path to terminal cancellation, slot release, and explicit failed-payment history while keeping late-success handling refund-only.
- Added `refunded` payment state, refund metadata, late-success auto-refund handling, and customer-visible refund fields in payment history.
- Added `orders.getReorderDefaults`, `/customer/new-order?reorderFrom=<orderId>`, prefilled reorder UI, and reorder CTA on cancelled failed/refunded orders.
- Replaced retry-oriented tests with cancellation/refund/reorder coverage, added node-level webhook tests, and updated the gated Stripe e2e to follow decline -> reorder -> success.
- Verification passed with `npm run codegen`, `npm test`, `npm run lint`, `npm run build`, and `npx convex dev --once`; live Stripe checks confirmed decline -> cancelled + reorder CTA and reordered success -> `awaiting_dropoff`.
