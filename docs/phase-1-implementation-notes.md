# Phase 1 Implementation Notes

This repo now implements the **customer checkout foundation** described by the
project docs, with a narrower phase-1 scope than the broader future-state
architecture.

## Locked defaults

- Capacity is measured in **load units**, not order count.
- Draft orders place a **timed hold** on both the selected drop-off slot and
  delivery slot.
- Payment is currently a **mock Stripe-compatible backend boundary**:
  `payments.createCheckoutSession` opens a mock session and
  `payments.completeMockCheckout` confirms payment.
- The first shipped UI scope is **customer-only**:
  sign-in, sign-up, profile, new order, order list, and order detail.
- The system is seeded as **single branch** with a fixed **per-load** price.

## Deferred from phase 1

- Worker, driver, and admin interfaces
- Real Stripe webhook handling
- Notifications delivery
- File uploads and issue workflows
- Pricing management UI
- Multi-branch operations

## Environment requirements

Frontend:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

Backend / Convex auth:

- `CLERK_JWT_ISSUER_DOMAIN`

## Notes on auth

- Clerk is the identity provider for the web app.
- Convex stores the application profile in `users`.
- `convex/auth.config.ts` is configured for Clerk JWT validation with
  `applicationID: "convex"`.
- Clerk is running in `routing="path"` mode, so TanStack Router must explicitly
  match nested auth subpaths under `/sign-in/*` and `/sign-up/*` such as
  `/sign-in/factor-one`.
