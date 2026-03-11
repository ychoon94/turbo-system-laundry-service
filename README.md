# Thread & Tide Laundry Operations

Laundry checkout plus in-shop operations built with React, Clerk, Convex, and Stripe.

## Current Scope

- Customer auth with Clerk
- Profile bootstrap and saved delivery addresses
- Load-based slot selection for drop-off and delivery
- Hosted Stripe Checkout with webhook-confirmed payment status
- First failed Stripe payment attempts cancel the held order and expose reorder
- Automatic refund protection if Stripe later reports success for a cancelled order
- Customer order detail, timed-hold visibility, and payment history
- Admin order board with assignment filters and issue-hold recovery
- Worker queue with operational status transitions from `awaiting_dropoff` through `ready_for_delivery`
- Issue reporting with Convex file-storage evidence uploads

Driver workflows, notifications, pricing UI, analytics, staff onboarding UI, and
multi-branch operations are still deferred.

## Stack

- React 19 + Vite + TypeScript
- TanStack Router + Convex React
- Clerk for auth
- Convex for backend data/functions/http routes/cron cleanup
- Stripe Checkout + webhook reconciliation

## Environment

Frontend:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL` optional local/public site URL for convenience

Backend / Convex:

- `CLERK_JWT_ISSUER_DOMAIN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL` optional fallback when frontend origin is not passed to checkout

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npm run codegen`

## Checkout Notes

- Slot capacity is stored explicitly in `timeSlots.reservedLoads`.
- Draft orders reserve both chosen slots immediately.
- Stripe webhook events are the source of truth for payment success.
- The first `payment_intent.payment_failed` cancels the order and releases both slot holds.
- Cancelled failed/refunded orders can be reordered through a prefilled `/customer/new-order?reorderFrom=<orderId>` flow.
- A scheduled cleanup pass releases expired unpaid holds as a safety net.

## Operations Notes

- Paid orders can move through `awaiting_dropoff -> received_at_shop -> washing -> drying -> folding -> ready_for_delivery`.
- Admins assign one active worker per order and can resume orders from `issue_hold`.
- Workers can only view and progress their assigned orders.
- Issue reports can include uploaded evidence files stored in Convex file storage.
- Staff users must already exist in Clerk and have matching `users` rows in Convex with `role = "admin"` or `role = "worker"`.

## Local Stripe Webhook Test

1. Install the Stripe CLI and ensure `STRIPE_SECRET_KEY` exists in `.env.local`.
2. Start a local forwarder to the Convex site webhook endpoint:
   `stripe listen --forward-to https://<your-convex-site>.convex.site/webhooks/stripe`
3. Copy the printed `whsec_...` secret into Convex:
   `npx convex env set STRIPE_WEBHOOK_SECRET <whsec_...>`
4. Keep the listener running while you open a customer order and:
   use `4000 0000 0000 0002` to verify first-failure cancellation + reorder, or
   use `4242 4242 4242 4242` to verify the paid path.
5. Confirm the listener shows the relevant Stripe events forwarded with HTTP `200`, then verify:
   failed first attempt -> order becomes `cancelled` with reorder CTA, or
   successful payment -> order moves to `awaiting_dropoff` and appears as paid in `/customer/payments`.

See `docs/phase-1-implementation-notes.md` for the implementation defaults and deferred scope.
