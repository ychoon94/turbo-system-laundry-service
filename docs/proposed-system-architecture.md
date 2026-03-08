## Direct recommendation

Use this stack shape:

- **Frontend shell:** React + TypeScript + Vite
- **UI system:** Tailwind CSS v4 + shadcn/ui + lucide-react
- **App routing:** **TanStack Router** as an added service/library
- **Primary backend:** **Convex** for database, realtime queries, mutations, actions, cron jobs, file storage, and HTTP/webhook endpoints
- **Auth:** **Clerk**
- **Payments:** **Stripe Checkout + webhooks**
- **Async client fetching:** **TanStack Query**, but only for **non-Convex** data flows
- **Suggested services:** **Sentry** for errors/performance, **Resend** for email notifications, **Mapbox** for address lookup / route support

That is the cleanest architecture because Convex already gives you a reactive backend with realtime sync, built-in cron, backend functions, and file storage, so you should let it own the core operational data model instead of splitting state across too many services. ([Convex][1])

---

## Important architecture opinion

**Do not use TanStack Query as the main data layer for laundry orders.**
Use **Convex React hooks** for the core app data, because Convex is explicitly designed to keep frontend and backend state in sync in realtime without needing separate websocket or cache invalidation logic. TanStack Query is still useful, but for:

- Stripe checkout session bootstrap
- address validation / map APIs
- one-off external API calls
- admin exports or reporting endpoints not modeled as live Convex data ([Convex][1])

That is the main trade-off decision in this architecture.

---

# Proposed system architecture

## 1. Frontend layer

### Recommended

- **React + TypeScript + Vite**
- **TanStack Router**
- **Tailwind CSS v4**
- **shadcn/ui**
- **lucide-react**
- **Clerk React SDK**
- **Convex React client**
- **TanStack Query**

Why:

- React’s official guidance says modern React apps should use a router and typically integrate routing with data fetching and prefetching; React specifically points to **TanStack Router** as one of the suggested router choices. ([React][2])
- Tailwind v4’s current docs position the **Vite plugin** path as the most seamless setup for React-style apps. ([Tailwind CSS][3])
- shadcn/ui remains a strong fit because it is intentionally open-code and meant to be customized into your own design system, which is good for a product with multiple role-based dashboards. ([Shadcn UI][4])

### Frontend app partitions

Create **one web app** with route groups by role:

- `/customer/*`
- `/worker/*`
- `/driver/*`
- `/admin/*`

Use role gating from Clerk session claims + Convex-side authorization checks.

---

## 2. Backend layer

### Core choice

Use **Convex as the operational backend**.

Convex should own:

- orders
- customers
- worker tasks
- delivery tasks
- time slots
- pricing rules
- payment state mirror
- notifications log
- audit trail
- dashboard aggregates
- uploaded issue photos / proof-of-delivery photos

Convex supports:

- TypeScript backend functions
- realtime queries
- mutations
- actions for third-party API calls
- cron jobs
- file storage
- HTTP actions / webhook-style endpoints ([Convex][1])

### Why Convex fits this product well

This app is heavily operational:

- statuses change often
- multiple users see the same order from different perspectives
- admins need live dashboards
- workers need live queues
- drivers need live task lists

That is exactly where Convex’s reactive model is strong. ([Convex][1])

---

## 3. Authentication and authorization

### Recommended auth model

Use **Clerk** for:

- sign up / sign in
- session management
- passwordless or OTP later if needed
- user profile base
- role claims / metadata
- organization support only if later you want multi-branch / franchise mode

Clerk’s current docs ecosystem emphasizes webhooks and org / RBAC flows, which fits this product if you later expand beyond a single laundry branch. ([Clerk][5])

### Practical model

Keep **identity in Clerk**, but create an **app user profile** in Convex:

`users`

- clerkUserId
- role: `customer | worker | driver | admin`
- status
- phone
- preferredName
- defaultAddressId
- createdAt

This avoids overloading Clerk with domain data.

### Authorization rule

Every sensitive mutation must be checked **inside Convex**, not only in the UI.

Example:

- customer can only read own orders
- worker can only read assigned laundry tasks
- driver can only read assigned delivery tasks
- admin can read branch-wide operations

---

## 4. Payment architecture

### Recommended

Use **Stripe Checkout Sessions** for initial implementation.

Why:

- low-friction
- secure hosted flow
- fastest to production
- fits “pay when placing order”

Stripe recommends a new Checkout Session each time the customer attempts a payment. Stripe Checkout Sessions are the standard hosted object for this flow. ([Stripe Docs][6])

### Payment flow

1. Customer creates draft order in Convex
2. Convex action creates Stripe Checkout Session
3. Store:
    - `orderId`
    - `customerId`
    - `slotId`
    - `branchId`
      inside Stripe metadata / client reference

4. Customer pays in Stripe Checkout
5. Stripe webhook hits Convex HTTP endpoint
6. Convex verifies event signature and updates:
    - payment status
    - order status
    - payment record

7. UI updates live from Convex

Using Stripe metadata to reconcile Stripe objects with your internal order IDs is an intended Stripe pattern. ([Stripe Docs][7])

### Webhook rule

Treat Stripe webhook as source of truth for final payment confirmation.
Do not trust frontend redirect success alone.

Stripe retries webhook delivery for up to 3 days in live mode if your endpoint does not return success, so idempotent processing is required. ([Stripe Docs][8])

### Later option

If you want:

- stored cards
- cancellation / no-show fees
- easier repeat orders

Stripe supports saving payment methods during Checkout using `setup_future_usage`. ([Stripe Docs][9])

---

## 5. Scheduling and operational workflow

This is the heart of the system.

### Main domain objects

I’d structure the backend around these aggregates:

- **User**
- **Address**
- **Branch**
- **Machine**
- **TimeSlot**
- **Order**
- **OrderItem / Load**
- **OrderStatusHistory**
- **LaundryTask**
- **DeliveryTask**
- **Payment**
- **Notification**
- **IssueReport**
- **Attachment**

### Order lifecycle

Recommended status model:

- `draft`
- `awaiting_payment`
- `paid`
- `pickup_scheduled`
- `awaiting_dropoff`
- `picked_up`
- `received_at_shop`
- `washing`
- `drying`
- `folding`
- `ready_for_delivery`
- `delivery_scheduled`
- `out_for_delivery`
- `delivered_to_lobby`
- `completed`
- `cancelled`
- `issue_hold`

This should be controlled by a backend state machine in Convex, not by freeform UI updates.

### Capacity model

Because pricing is per machine load and owner-defined capacity depends on available machines, your scheduling engine should reserve **slot capacity in load-units**, not just order count.

That means:

- slot capacity = total available machine-load capacity
- each order consumes `n` load units
- slot closes when remaining capacity < requested load units

That is more correct than “max X orders per slot.”

---

## 6. Notifications architecture

### Suggested services

- **Resend** for email
- optional SMS/WhatsApp later via another provider

Resend is a good fit for developer-friendly transactional email and works cleanly in TypeScript/serverless workflows. ([Resend][10])

### Notification triggers

Drive notifications from Convex mutations / background actions:

- order placed
- payment confirmed
- pickup reminder
- laundry received
- washing completed
- ready for delivery
- out for delivery
- delivered
- issue reported

### Pattern

Use an internal `notifications` table:

- type
- channel
- recipient
- payload
- status
- sentAt
- providerMessageId

That gives you auditability and retry support.

---

## 7. Delivery and maps

### Suggested service

Use **Mapbox** for:

- address autocomplete
- geocoding
- optional route links for drivers

Mapbox is still strong for search, geocoding, and routing APIs. ([Mapbox][11])

### Important business note

Because your confirmed business rule is **lobby/security-desk delivery only**, routing precision is less critical than last-meter notes, tower/block selection, and delivery instructions. So maps should be a support feature, not the system’s core.

Store:

- building name
- tower / block
- unit
- lobby / security desk note
- access note
- phone contact
- landmark

---

## 8. File and proof architecture

Use **Convex file storage** for:

- garment issue photos
- damaged-item photos
- delivery proof photos
- receipt / invoice attachments if needed later

Convex file storage supports upload URLs, storing files, serving files by URL, and metadata access. ([docs.convex.dev][12])

### Pattern

Photo upload flow:

1. frontend requests upload URL
2. uploads file directly
3. receives storage ID
4. saves storage ID to related issue/delivery record

This avoids sending large files through your main mutation payloads. ([docs.convex.dev][13])

---

## 9. Analytics and admin dashboard

### Recommendation

Use **Convex for operational analytics first**, not a separate warehouse initially.

Track:

- orders by status
- orders by slot
- loads sold
- revenue by day/week/month
- pickup punctuality
- delivery punctuality
- worker throughput
- issue rate
- refund / failed payment count

### Architecture choice

For v1:

- maintain live dashboard aggregates in Convex
- compute simple rollups via cron or mutation-triggered updates

Convex includes cron jobs and backend workflows, so you do not need a separate job runner just to produce daily metrics. ([Convex][1])

When scale grows, then export to a warehouse.

---

## 10. TanStack Query usage pattern

Because you explicitly want TanStack Query, here’s the right boundary.

### Use TanStack Query for

- Stripe session creation bootstrap
- geocoding / address suggestions
- admin CSV export requests
- third-party tracking or courier APIs later
- one-shot settings screens that do not need live sync

### Do not use TanStack Query for

- live order lists
- worker queue
- driver task board
- admin order monitor
- realtime status chips

Those should stay on Convex subscriptions / reactive queries. Convex explicitly markets that it removes the need for separate cache invalidation/websocket coordination for synced app state. ([Convex][1])

---

## 11. Suggested additional services

These are the ones I would add.

### A. TanStack Router

Best pairing with your React + TypeScript + TanStack Query preference. React’s own docs suggest TanStack Router as one of the recommended router options for modern apps. ([React][2])

### B. Sentry

Use for:

- frontend errors
- backend action failures
- performance tracing
- session replay for operational bugs

Sentry supports JS/React monitoring with error tracking, tracing, logs, and replay. ([Sentry Docs][14])

### C. Resend

Use for transactional email:

- order confirmation
- payment receipt
- schedule reminders
- issue notifications ([Resend][10])

### D. Mapbox

Use for address search + route support. ([Mapbox][11])

### E. Upstash Ratelimit

Optional. Useful only if you expect abuse on:

- OTP resend
- checkout/session creation
- address search
- public webhooks or public forms

Upstash offers serverless Redis / rate limiting products and is reasonable if you later need lightweight request throttling outside Convex. ([Upstash: Serverless Data Platform][15])

---

# Reference architecture diagram

```text
[ React + TS + Vite ]
        |
        |-- Clerk (auth UI, sessions)
        |-- TanStack Router
        |-- Tailwind v4 + shadcn/ui + lucide
        |-- Convex React client (core live app data)
        |-- TanStack Query (external async calls only)
        |
        v
[ Convex ]
  - database
  - queries / mutations
  - actions
  - cron jobs
  - file storage
  - webhook/http endpoints
  - auth-aware business rules
        |
        |-- Stripe API
        |     - Checkout Session
        |     - payment webhooks
        |
        |-- Resend
        |     - emails / reminders
        |
        |-- Mapbox
        |     - geocoding / route support
        |
        |-- Sentry
              - errors / tracing / replay
```

---

# Route architecture

```text
/
  /sign-in
  /sign-up

/customer
  /dashboard
  /orders
  /orders/:id
  /checkout/:draftOrderId
  /profile
  /payments

/worker
  /queue
  /orders/:id
  /issues

/driver
  /tasks
  /tasks/:id
  /history

/admin
  /dashboard
  /orders
  /orders/:id
  /slots
  /pricing
  /workers
  /drivers
  /analytics
  /settings
```

---

# Backend module architecture

```text
convex/
  schema.ts

  users/
    queries.ts
    mutations.ts

  addresses/
    queries.ts
    mutations.ts

  orders/
    queries.ts
    mutations.ts
    stateMachine.ts

  slots/
    queries.ts
    mutations.ts
    capacity.ts

  workers/
    queries.ts
    mutations.ts

  deliveries/
    queries.ts
    mutations.ts
    routing.ts

  payments/
    queries.ts
    mutations.ts
    stripe.ts
    webhooks.ts

  notifications/
    queries.ts
    mutations.ts
    email.ts
    scheduler.ts

  analytics/
    queries.ts
    rollups.ts

  files/
    mutations.ts
    queries.ts

  auth/
    clerk.ts
    guards.ts
```

---

# Key engineering rules

## Rule 1

**Convex is the source of truth for operational state.**

## Rule 2

**Stripe webhook is the source of truth for payment completion.**

## Rule 3

**Clerk is the source of truth for identity, but app role/profile lives in Convex.**

## Rule 4

**Use TanStack Query only for external async calls, not core reactive domain state.**

## Rule 5

**All role checks happen in Convex functions, not just frontend route guards.**

---

# Suggested implementation phases

## Phase 1

Foundation

- React + Vite + TS
- Tailwind v4
- shadcn/ui
- Clerk
- Convex
- TanStack Router
- role-based shell

## Phase 2

Customer order flow

- addresses
- order draft
- slot selection
- Stripe checkout
- payment webhook
- order confirmation

## Phase 3

Operations

- admin order board
- worker queue
- status transitions
- issue reporting
- file uploads

## Phase 4

Delivery

- driver task board
- route links
- proof of delivery
- incident handling

## Phase 5

Notifications + analytics

- Resend
- reminders
- punctuality metrics
- admin dashboard
- Sentry

---

# My opinionated stack summary

If this were my build, I would use:

- **Vite**
- **React + TypeScript**
- **TanStack Router**
- **Tailwind v4 + shadcn/ui + lucide**
- **Clerk**
- **Convex**
- **Stripe Checkout**
- **Resend**
- **Sentry**
- **Mapbox**
- **TanStack Query only for non-Convex calls**

[1]: https://www.convex.dev/ 'Convex | The backend platform that keeps your app in sync'
[2]: https://react.dev/learn/build-a-react-app-from-scratch 'Build a React app from Scratch – React'
[3]: https://tailwindcss.com/docs 'Installing Tailwind CSS with Vite - Tailwind CSS'
[4]: https://ui.shadcn.com/ 'The Foundation for your Design System - shadcn/ui'
[5]: https://clerk.com/docs/guides/ai/skills 'Clerk Skills - AI | Clerk Docs'
[6]: https://docs.stripe.com/api/checkout/sessions?utm_source=chatgpt.com 'Checkout Sessions | Stripe API Reference'
[7]: https://docs.stripe.com/api/checkout/sessions/create?utm_source=chatgpt.com 'Create a Checkout Session | Stripe API Reference'
[8]: https://docs.stripe.com/webhooks?utm_source=chatgpt.com 'Receive Stripe events in your webhook endpoint'
[9]: https://docs.stripe.com/payments/checkout/save-during-payment?payment-ui=embedded-form&utm_source=chatgpt.com 'Save payment details during - Stripe Checkout'
[10]: https://resend.com/?utm_source=chatgpt.com 'Resend · Email for developers'
[11]: https://www.mapbox.com/?utm_source=chatgpt.com 'Mapbox | Maps, Navigation, Search, and Data'
[12]: https://docs.convex.dev/file-storage?utm_source=chatgpt.com 'File Storage | Convex Developer Hub'
[13]: https://docs.convex.dev/file-storage/upload-files?utm_source=chatgpt.com 'Uploading and Storing Files | Convex Developer Hub'
[14]: https://docs.sentry.io/?utm_source=chatgpt.com 'Sentry Docs | Application Performance Monitoring & Error ...'
[15]: https://upstash.com/?utm_source=chatgpt.com 'Upstash: Serverless Data Platform'
