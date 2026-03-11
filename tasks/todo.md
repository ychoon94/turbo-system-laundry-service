# Task Checklist

## Current Task

- [completed] Fix the accepted review findings for issue-hold creation safety and admin-order detail scope, then verify with focused tests.

## Steps

- [completed] Re-check the worker issue-hold flow and admin detail query against the reported review findings.
- [completed] Prevent issue-report creation from succeeding when the order cannot legally enter `issue_hold`, and reflect that guard in the worker UI.
- [completed] Enforce the same operational-order scope in admin detail that the admin board already applies.
- [completed] Run focused tests for the changed backend and route/UI paths, then capture the result and any new lessons.

## Acceptance Criteria

- Workers cannot create a new open issue record for an order that is already in `issue_hold` or any other non-hold-entry state.
- The worker detail page does not present a live "Create issue hold" path when the current order state cannot transition into `issue_hold`.
- Direct admin detail access rejects non-operational or unpaid orders instead of exposing them outside the admin board contract.
- Focused automated verification covers the mutated issue/admin paths without regressing the existing operational tests.

## Results

- Tightened `convex/issues.ts` so issue-report creation now shares the same hold-entry state gate as `putOnIssueHold`, preventing orphan open issues when the order is already paused or otherwise ineligible.
- Updated `src/pages/worker-order-detail-page.tsx` to explain when issue hold is available and disable the form controls plus submit button when the current order state cannot transition into `issue_hold`.
- Scoped `orders.getAdminOrderDetail` to operational paid orders so direct admin detail navigation no longer bypasses the admin board contract.
- Verification passed with `npm test -- src/test/issues-and-queue.test.ts src/test/operations-mutations.test.ts src/test/worker-order-detail-page.test.tsx` and `npm run lint`.

## Current Task

- [completed] Apply the UI review fixes for shared sign-in copy, URL-backed admin filters, and cleaner customer payment detail states, then verify with tests and Playwright.

## Steps

- [completed] Inspect the flagged route/page files and confirm the concrete causes behind each review finding.
- [completed] Move admin board filters into typed route search params and preserve them through detail navigation.
- [completed] Update the shared sign-in shell copy and simplify the customer order detail payment sidebar.
- [completed] Run focused verification plus repo checks, then record the result and any follow-up lessons.

## Acceptance Criteria

- Admin board filters survive refresh, browser navigation, and the in-app back link because they live in the URL.
- The shared `/sign-in` page reads correctly for customer, worker, and admin accounts before redirect.
- Paid customer order detail no longer repeats the payment-history CTA or exposes a standalone raw Stripe session block.
- Verification covers the updated auth copy, route behavior, and customer/admin UI paths without introducing regressions.

## Results

- Added a shared admin-orders search schema/helper so the board filter state now lives in the URL and survives reload plus the admin detail back link.
- Rewrote the shared sign-in shell copy so it reads correctly for customer, worker, and admin accounts before role-based redirect.
- Removed the standalone raw Stripe session block from customer order detail and kept the secondary payment-history link out of the paid-order path.
- Verification passed with `npm test`, `npm run lint`, `npm run build`, and a focused Playwright browser check covering sign-in copy, admin URL-backed filters, and customer payment detail cleanup.

## Current Task

- [completed] Implement phase 3 admin + worker operations: operational order state machine, worker assignment, issue handling with evidence uploads, role-aware routes, and ops UI verification.

## Steps

- [completed] Re-check the existing customer checkout slice, auth shell, and backend seams that Phase 3 will extend.
- [completed] Update shared Convex domain/schema/auth helpers for operational statuses, worker assignment, and issue reports with evidence storage.
- [completed] Implement backend queries/mutations for admin order board/detail, worker queue/detail, lifecycle transitions, and issue hold/resume flows.
- [completed] Update the React app for role-aware routing, suite-specific navigation, worker/admin pages, and customer-visible status expansion.
- [completed] Regenerate Convex types and run verification: targeted/new tests, full `npm test`, `npm run lint`, `npm run build`, and feasible Convex sync checks.

## Acceptance Criteria

- Paid customer orders can move through `awaiting_dropoff -> received_at_shop -> washing -> drying -> folding -> ready_for_delivery` with backend-enforced role and state checks.
- Admins can view/filter operational orders, assign one active worker per order, inspect issue state, and resume issue-held orders.
- Workers can view only their assigned queue, progress permitted lifecycle steps, and create issue reports with uploaded evidence.
- Customer order detail/history continues to work and reflects the new operational statuses without regressing checkout/payment behavior.

## Results

- Extended the Convex domain/schema with operational order statuses, worker assignment state, and an `issueReports` table backed by Convex file storage IDs.
- Added admin/worker backend APIs for order board/detail views, worker queue/detail views, assignment, lifecycle transitions, issue creation, and issue-hold recovery.
- Converted the router and shell from customer-only to role-aware suites, then added `/admin/orders`, `/admin/orders/$orderId`, `/worker/queue`, and `/worker/orders/$orderId`.
- Expanded automated coverage with operational state-machine tests, assignment/issue mutation tests, and queue/issue query tests while keeping the existing checkout/payment suite green.
- Refreshed `README.md` and `test-credential.md` to reflect the shipped ops slice and the manual staff-provisioning requirement.

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
