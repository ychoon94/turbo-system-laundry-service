# Thread & Tide Customer Checkout

Customer-facing laundry checkout built with React, Clerk, Convex, and Stripe.

## Current Scope

- Customer auth with Clerk
- Profile bootstrap and saved delivery addresses
- Load-based slot selection for drop-off and delivery
- Hosted Stripe Checkout with webhook-confirmed payment status
- First failed Stripe payment attempts cancel the held order and expose reorder
- Automatic refund protection if Stripe later reports success for a cancelled order
- Customer order detail, timed-hold visibility, and payment history

Worker, driver, admin, notifications, uploads, pricing UI, and multi-branch
operations are still deferred.

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
