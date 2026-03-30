# Current Implementation Notes

This repo now ships the customer checkout slice, the in-shop worker/admin
operations slice, and the phase 4 driver-delivery slice. The broader product
architecture docs still describe future-state capabilities beyond what is in
production here.

## Locked defaults

- Capacity is measured in **load units**, not order count.
- Draft orders reserve both the selected drop-off slot and delivery slot
  immediately.
- Timed holds run for **30 minutes** so the reservation window matches Stripe
  Checkout session expiry requirements.
- Payment uses **hosted Stripe Checkout** and is confirmed only by webhook
  reconciliation.
- The system is still seeded as **single branch** with a fixed **per-load**
  price.
- Customer orders remain **`self_dropoff` only**. Pickup-service workflows are
  still deferred.

## Shipped scope

- Customer sign-in/sign-up, profile bootstrap, saved addresses, new-order
  flow, order history/detail, payment history, and reorder from failed/refunded
  orders
- Stripe-backed `payments.createCheckoutSession`, webhook handling at
  `/webhooks/stripe`, late-success refund protection, and expired-hold cleanup
- Admin order board/detail with worker assignment, delivery assignment, and
  issue-hold recovery
- Worker queue/detail with status transitions from `awaiting_dropoff` through
  `ready_for_delivery`
- Driver queue/detail with `ready_for_delivery -> out_for_delivery ->
  delivered`, proof uploads, and delivery-issue return to
  `ready_for_delivery`
- Explicit `timeSlots.reservedLoads` tracking and Convex file storage for issue
  evidence plus delivery proof

## Deferred

- Notifications delivery
- Pricing management UI
- Analytics dashboards
- Staff onboarding UI
- Pickup-service workflows
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

## Auth and staffing notes

- Clerk is the identity provider for the web app.
- Convex stores the application profile in `users`.
- `convex/auth.config.ts` is configured for Clerk JWT validation with
  `applicationID: "convex"`.
- Clerk runs in `routing="path"` mode, so TanStack Router must explicitly match
  nested auth subpaths under `/sign-in/*` and `/sign-up/*`.
- Customer accounts are auto-provisioned on first sign-in.
- Admin, worker, and driver accounts must be provisioned manually in Clerk and
  mirrored into Convex `users` with the matching role.
