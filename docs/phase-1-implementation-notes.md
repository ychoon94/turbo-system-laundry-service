# Current Implementation Notes

This repo now implements the **customer checkout path** described by the
project docs, still within a narrower customer-only scope than the broader
future-state architecture.

## Locked defaults

- Capacity is measured in **load units**, not order count.
- Draft orders reserve both the selected drop-off slot and delivery slot
  immediately.
- Timed holds now run for **30 minutes** so the reservation window matches
  Stripe Checkout session expiry requirements.
- Payment uses **hosted Stripe Checkout** and is confirmed only by webhook
  reconciliation.
- The shipped UI scope is still **customer-only**:
  sign-in, sign-up, profile, new order, order list, order detail, and payment
  history.
- The system is still seeded as **single branch** with a fixed **per-load**
  price.

## Shipped in this phase

- Stripe-backed `payments.createCheckoutSession`
- Stripe webhook route at `/webhooks/stripe`
- Payment history via `payments.getMyPayments`
- Explicit `timeSlots.reservedLoads` tracking
- Scheduled cleanup for expired unpaid holds

## Deferred

- Worker, driver, and admin interfaces
- Notifications delivery
- File uploads and issue workflows
- Pricing management UI
- Multi-branch operations

## Environment requirements

Frontend:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL` optional

Backend / Convex auth:

- `CLERK_JWT_ISSUER_DOMAIN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL` optional fallback

## Notes on auth and checkout

- Clerk is the identity provider for the web app.
- Convex stores the application profile in `users`.
- `convex/auth.config.ts` is configured for Clerk JWT validation with
  `applicationID: "convex"`.
- Clerk runs in `routing="path"` mode, so TanStack Router must explicitly match
  nested auth subpaths under `/sign-in/*` and `/sign-up/*`.
- The customer UI can open Stripe Checkout, but only webhook processing moves
  the order into `awaiting_dropoff`.
