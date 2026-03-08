## Direct recommendation

Use these as your **core domain aggregates**:

- `users`
- `addresses`
- `branches`
- `machines`
- `timeSlots`
- `orders`
- `orderStatusHistory`
- `workerAssignments`
- `deliveryTasks`
- `payments`
- `notifications`
- `issueReports`
- `attachments`

For Convex specifically, the right shape is:

- define tables in `schema.ts` with `defineSchema` / `defineTable`
- add indexes early for operational lookups
- use validators for document fields and function args/returns
- use scheduled functions / cron for reminders and delayed ops
- use file storage for proof photos and issue images. ([docs.convex.dev][1])

---

# 1. Domain model

## A. Identity and access

### `users`

Purpose: application-level profile tied to Clerk identity.

Fields:

- `_id`
- `clerkUserId`
- `role` = `customer | worker | driver | admin`
- `status` = `active | inactive`
- `fullName`
- `phone`
- `email`
- `defaultAddressId?`
- `branchId?` for staff
- `createdAt`
- `updatedAt`

Why:
Clerk should remain the identity provider, while your role and business-specific profile live in Convex. Clerk has a first-class Convex integration path, and syncing Clerk users into Convex is a standard pattern. ([Clerk][2])

Indexes:

- `by_clerk_user_id`
- `by_role`
- `by_branch_role`

---

### `addresses`

Purpose: reusable customer addresses and delivery instructions.

Fields:

- `_id`
- `userId`
- `label` (`home`, `office`, etc.)
- `contactName`
- `contactPhone`
- `addressLine1`
- `addressLine2?`
- `postcode`
- `city`
- `state`
- `buildingName`
- `towerBlock?`
- `unitNumber?`
- `lobbyOrSecurityNote`
- `accessInstructions?`
- `latitude?`
- `longitude?`
- `isDefault`
- `createdAt`
- `updatedAt`

Indexes:

- `by_user`
- `by_user_default`

---

## B. Branch and machine capacity

### `branches`

Purpose: support one or more laundry locations later.

Fields:

- `_id`
- `name`
- `phone`
- `email`
- `address`
- `timezone`
- `isActive`
- `createdAt`
- `updatedAt`

---

### `machines`

Purpose: operational capacity source.

Fields:

- `_id`
- `branchId`
- `machineCode`
- `machineType` = `washer | dryer`
- `loadCapacity`
- `status` = `active | maintenance | inactive`
- `notes?`
- `createdAt`
- `updatedAt`

Indexes:

- `by_branch`
- `by_branch_status`
- `by_branch_type_status`

### Architecture note

Even though the business explained capacity as “number of orders per slot,” the more correct domain model is **slot capacity in load-units**, because price is per machine load and owner availability is based on machine resources. That gives you fewer edge-case bugs later.

---

## C. Scheduling

### `timeSlots`

Purpose: owner-managed pickup/drop-off/delivery availability.

Fields:

- `_id`
- `branchId`
- `slotType` = `dropoff | pickup | delivery`
- `date`
- `startTime`
- `endTime`
- `capacityLoads`
- `reservedLoads`
- `status` = `open | closed | full`
- `cutoffMinutesBeforeStart`
- `createdBy`
- `createdAt`
- `updatedAt`

Derived:

- `remainingLoads = capacityLoads - reservedLoads`

Indexes:

- `by_branch_type_date`
- `by_branch_date`
- `by_branch_type_status_date`

This table is critical because Convex queries become efficient when you define indexes and query through them with `withIndex()`, instead of relying on full table scans. ([docs.convex.dev][3])

---

## D. Core business aggregate

### `orders`

Purpose: the main aggregate root.

Fields:

- `_id`
- `orderNumber`
- `customerId`
- `branchId`

Service definition:

- `serviceType` = `self_dropoff | pickup_service`

Scheduling:

- `dropoffSlotId?`
- `pickupSlotId?`
- `deliverySlotId`
- `addressId`

Commercial:

- `loadCount`
- `unitPriceSnapshot`
- `subtotalAmount`
- `discountAmount`
- `totalAmount`
- `currency`

Customer input:

- `specialInstructions?`

Operational:

- `currentStatus`
- `paymentStatus` = `pending | paid | failed | refunded | partially_refunded`
- `assignedWorkerId?`
- `assignedDriverId?`

Timeline:

- `placedAt`
- `paidAt?`
- `receivedAtShopAt?`
- `washingStartedAt?`
- `washingCompletedAt?`
- `dryingCompletedAt?`
- `foldingCompletedAt?`
- `outForDeliveryAt?`
- `deliveredAt?`
- `completedAt?`
- `cancelledAt?`

Audit:

- `createdAt`
- `updatedAt`
- `createdByUserId?`

Indexes:

- `by_order_number`
- `by_customer`
- `by_branch_status`
- `by_branch_date`
- `by_payment_status`
- `by_worker_status`
- `by_driver_status`
- `by_delivery_slot`
- `by_pickup_slot`
- `by_dropoff_slot`

### Recommended statuses

Use a strict state machine:

- `draft`
- `awaiting_payment`
- `paid`
- `awaiting_dropoff`
- `pickup_scheduled`
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

That matches the product flow already locked by the user stories.

---

### `orderStatusHistory`

Purpose: immutable audit trail for ops and support.

Fields:

- `_id`
- `orderId`
- `fromStatus?`
- `toStatus`
- `changedByUserId?`
- `changeSource` = `customer | worker | driver | admin | system | webhook`
- `notes?`
- `createdAt`

Indexes:

- `by_order`
- `by_order_created_at`

This table is worth keeping even if `orders.currentStatus` exists, because it gives you:

- support investigation
- SLA / punctuality analysis
- operational audit trail

---

## E. Assignments and delivery

### `workerAssignments`

Purpose: assign processing responsibility cleanly.

Fields:

- `_id`
- `orderId`
- `workerId`
- `assignmentType` = `laundry_processing`
- `assignedAt`
- `assignedBy`
- `status` = `assigned | accepted | completed | reassigned | cancelled`

Indexes:

- `by_worker_status`
- `by_order`

You could fold this into `orders.assignedWorkerId`, but a separate table gives you reassignment history and future flexibility.

---

### `deliveryTasks`

Purpose: driver-facing unit of work.

Fields:

- `_id`
- `orderId`
- `driverId`
- `taskType` = `pickup | delivery`
- `addressId`
- `slotId`
- `status` = `assigned | in_progress | completed | failed | cancelled`
- `startedAt?`
- `completedAt?`
- `failureReason?`
- `proofAttachmentId?`
- `createdAt`
- `updatedAt`

Indexes:

- `by_driver_status`
- `by_driver_slot`
- `by_order`
- `by_task_type_status`

This is better than putting delivery directly into `orders`, because pickup and delivery are operational tasks with their own lifecycle.

---

## F. Payments

### `payments`

Purpose: Stripe mirror and accounting trace.

Fields:

- `_id`
- `orderId`
- `customerId`
- `provider` = `stripe`
- `providerCheckoutSessionId?`
- `providerPaymentIntentId?`
- `providerChargeId?`
- `status` = `pending | paid | failed | refunded | partially_refunded`
- `amount`
- `currency`
- `metadata?`
- `paidAt?`
- `failedAt?`
- `refundedAt?`
- `webhookEventId?`
- `createdAt`
- `updatedAt`

Indexes:

- `by_order`
- `by_customer`
- `by_provider_checkout_session`
- `by_provider_payment_intent`
- `by_status`

### Important rule

Treat Stripe webhook reconciliation as the final source of truth for payment success. That architecture is the safe one for order confirmation. Stripe webhook delivery and retries are built for this server-side confirmation pattern. ([docs.convex.dev][4])

---

## G. Notifications

### `notifications`

Purpose: operational and customer communication log.

Fields:

- `_id`
- `userId`
- `orderId?`
- `channel` = `email | push | sms | in_app`
- `templateKey`
- `payload`
- `status` = `queued | sent | failed | cancelled`
- `scheduledFor?`
- `sentAt?`
- `providerMessageId?`
- `failureReason?`
- `createdAt`
- `updatedAt`

Indexes:

- `by_user`
- `by_order`
- `by_status`
- `by_scheduled_for`

Convex supports both recurring cron jobs and delayed scheduled functions, so reminders can be modeled cleanly without bolting on another job system for v1. ([docs.convex.dev][5])

---

## H. Issues and files

### `issueReports`

Purpose: exceptions during wash/delivery.

Fields:

- `_id`
- `orderId`
- `reportedByUserId`
- `issueType` = `garment_damage | machine_issue | missing_item | access_problem | delay | other`
- `description`
- `status` = `open | under_review | resolved | dismissed`
- `createdAt`
- `resolvedAt?`

Indexes:

- `by_order`
- `by_status`
- `by_issue_type`

---

### `attachments`

Purpose: file metadata linked to orders, deliveries, and issues.

Fields:

- `_id`
- `storageId`
- `entityType` = `issue_report | delivery_task | order`
- `entityId`
- `uploadedByUserId`
- `fileName`
- `mimeType`
- `sizeBytes?`
- `createdAt`

Indexes:

- `by_entity`
- `by_uploaded_by`

Convex file storage supports upload URLs, serving files by URL, and file metadata access, which makes it a good fit for issue photos and proof-of-delivery images. ([docs.convex.dev][6])

---

# 2. Relationship model

Here’s the relational picture in plain English:

- one `user` can have many `addresses`
- one `branch` can have many `machines`
- one `branch` can have many `timeSlots`
- one `customer user` can have many `orders`
- one `order` belongs to one `address`
- one `order` may consume:
    - one `dropoffSlot` or one `pickupSlot`
    - one `deliverySlot`

- one `order` has many `orderStatusHistory` rows
- one `order` can have many `payments` records over time
- one `order` can have one or more `workerAssignments`
- one `order` can have up to two `deliveryTasks` in common flow:
    - pickup task
    - delivery task

- one `order` can have many `issueReports`
- one `issueReport` or `deliveryTask` can have many `attachments`

---

# 3. Recommended Convex schema shape

This is the structure I would start with.

```ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
    users: defineTable({
        clerkUserId: v.string(),
        role: v.union(v.literal('customer'), v.literal('worker'), v.literal('driver'), v.literal('admin')),
        status: v.union(v.literal('active'), v.literal('inactive')),
        fullName: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        defaultAddressId: v.optional(v.id('addresses')),
        branchId: v.optional(v.id('branches')),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index('by_clerk_user_id', ['clerkUserId'])
        .index('by_role', ['role'])
        .index('by_branch_role', ['branchId', 'role']),

    addresses: defineTable({
        userId: v.id('users'),
        label: v.string(),
        contactName: v.string(),
        contactPhone: v.string(),
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        postcode: v.string(),
        city: v.string(),
        state: v.string(),
        buildingName: v.string(),
        towerBlock: v.optional(v.string()),
        unitNumber: v.optional(v.string()),
        lobbyOrSecurityNote: v.string(),
        accessInstructions: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        isDefault: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index('by_user', ['userId'])
        .index('by_user_default', ['userId', 'isDefault']),

    branches: defineTable({
        name: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.string(),
        timezone: v.string(),
        isActive: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }),

    machines: defineTable({
        branchId: v.id('branches'),
        machineCode: v.string(),
        machineType: v.union(v.literal('washer'), v.literal('dryer')),
        loadCapacity: v.number(),
        status: v.union(v.literal('active'), v.literal('maintenance'), v.literal('inactive')),
        notes: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index('by_branch_type_status', ['branchId', 'machineType', 'status']),

    timeSlots: defineTable({
        branchId: v.id('branches'),
        slotType: v.union(v.literal('dropoff'), v.literal('pickup'), v.literal('delivery')),
        date: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        capacityLoads: v.number(),
        reservedLoads: v.number(),
        status: v.union(v.literal('open'), v.literal('closed'), v.literal('full')),
        cutoffMinutesBeforeStart: v.number(),
        createdBy: v.id('users'),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index('by_branch_type_date', ['branchId', 'slotType', 'date']),

    orders: defineTable({
        orderNumber: v.string(),
        customerId: v.id('users'),
        branchId: v.id('branches'),
        serviceType: v.union(v.literal('self_dropoff'), v.literal('pickup_service')),
        dropoffSlotId: v.optional(v.id('timeSlots')),
        pickupSlotId: v.optional(v.id('timeSlots')),
        deliverySlotId: v.id('timeSlots'),
        addressId: v.id('addresses'),
        loadCount: v.number(),
        unitPriceSnapshot: v.number(),
        subtotalAmount: v.number(),
        discountAmount: v.number(),
        totalAmount: v.number(),
        currency: v.string(),
        specialInstructions: v.optional(v.string()),
        currentStatus: v.string(),
        paymentStatus: v.union(
            v.literal('pending'),
            v.literal('paid'),
            v.literal('failed'),
            v.literal('refunded'),
            v.literal('partially_refunded')
        ),
        assignedWorkerId: v.optional(v.id('users')),
        assignedDriverId: v.optional(v.id('users')),
        placedAt: v.number(),
        paidAt: v.optional(v.number()),
        receivedAtShopAt: v.optional(v.number()),
        washingStartedAt: v.optional(v.number()),
        washingCompletedAt: v.optional(v.number()),
        dryingCompletedAt: v.optional(v.number()),
        foldingCompletedAt: v.optional(v.number()),
        outForDeliveryAt: v.optional(v.number()),
        deliveredAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index('by_order_number', ['orderNumber'])
        .index('by_customer', ['customerId'])
        .index('by_branch_status', ['branchId', 'currentStatus'])
        .index('by_payment_status', ['paymentStatus']),

    orderStatusHistory: defineTable({
        orderId: v.id('orders'),
        fromStatus: v.optional(v.string()),
        toStatus: v.string(),
        changedByUserId: v.optional(v.id('users')),
        changeSource: v.union(
            v.literal('customer'),
            v.literal('worker'),
            v.literal('driver'),
            v.literal('admin'),
            v.literal('system'),
            v.literal('webhook')
        ),
        notes: v.optional(v.string()),
        createdAt: v.number(),
    }).index('by_order', ['orderId']),

    workerAssignments: defineTable({
        orderId: v.id('orders'),
        workerId: v.id('users'),
        assignmentType: v.literal('laundry_processing'),
        assignedAt: v.number(),
        assignedBy: v.id('users'),
        status: v.union(
            v.literal('assigned'),
            v.literal('accepted'),
            v.literal('completed'),
            v.literal('reassigned'),
            v.literal('cancelled')
        ),
    })
        .index('by_worker_status', ['workerId', 'status'])
        .index('by_order', ['orderId']),

    deliveryTasks: defineTable({
        orderId: v.id('orders'),
        driverId: v.id('users'),
        taskType: v.union(v.literal('pickup'), v.literal('delivery')),
        addressId: v.id('addresses'),
        slotId: v.id('timeSlots'),
        status: v.union(
            v.literal('assigned'),
            v.literal('in_progress'),
            v.literal('completed'),
            v.literal('failed'),
            v.literal('cancelled')
        ),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        failureReason: v.optional(v.string()),
        proofAttachmentId: v.optional(v.id('attachments')),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index('by_driver_status', ['driverId', 'status'])
        .index('by_order', ['orderId']),

    payments: defineTable({
        orderId: v.id('orders'),
        customerId: v.id('users'),
        provider: v.literal('stripe'),
        providerCheckoutSessionId: v.optional(v.string()),
        providerPaymentIntentId: v.optional(v.string()),
        providerChargeId: v.optional(v.string()),
        status: v.union(
            v.literal('pending'),
            v.literal('paid'),
            v.literal('failed'),
            v.literal('refunded'),
            v.literal('partially_refunded')
        ),
        amount: v.number(),
        currency: v.string(),
        metadata: v.optional(v.any()),
        paidAt: v.optional(v.number()),
        failedAt: v.optional(v.number()),
        refundedAt: v.optional(v.number()),
        webhookEventId: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index('by_order', ['orderId'])
        .index('by_status', ['status'])
        .index('by_provider_checkout_session', ['providerCheckoutSessionId']),

    notifications: defineTable({
        userId: v.id('users'),
        orderId: v.optional(v.id('orders')),
        channel: v.union(v.literal('email'), v.literal('push'), v.literal('sms'), v.literal('in_app')),
        templateKey: v.string(),
        payload: v.any(),
        status: v.union(v.literal('queued'), v.literal('sent'), v.literal('failed'), v.literal('cancelled')),
        scheduledFor: v.optional(v.number()),
        sentAt: v.optional(v.number()),
        providerMessageId: v.optional(v.string()),
        failureReason: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index('by_scheduled_for', ['scheduledFor']),

    issueReports: defineTable({
        orderId: v.id('orders'),
        reportedByUserId: v.id('users'),
        issueType: v.union(
            v.literal('garment_damage'),
            v.literal('machine_issue'),
            v.literal('missing_item'),
            v.literal('access_problem'),
            v.literal('delay'),
            v.literal('other')
        ),
        description: v.string(),
        status: v.union(v.literal('open'), v.literal('under_review'), v.literal('resolved'), v.literal('dismissed')),
        createdAt: v.number(),
        resolvedAt: v.optional(v.number()),
    })
        .index('by_order', ['orderId'])
        .index('by_status', ['status']),

    attachments: defineTable({
        storageId: v.string(),
        entityType: v.union(v.literal('issue_report'), v.literal('delivery_task'), v.literal('order')),
        entityId: v.string(),
        uploadedByUserId: v.id('users'),
        fileName: v.string(),
        mimeType: v.string(),
        sizeBytes: v.optional(v.number()),
        createdAt: v.number(),
    }).index('by_entity', ['entityType', 'entityId']),
});
```

Convex’s schema model, validators, and indexes are all aligned with this approach. ([docs.convex.dev][1])

---

# 4. Key invariants

These are the business rules I would enforce in backend mutations.

## Scheduling invariants

- `reservedLoads <= capacityLoads`
- an order with `loadCount = n` can only reserve a slot if remaining capacity is at least `n`
- only one of `dropoffSlotId` or `pickupSlotId` should be set for initial intake
- `deliverySlotId` is always required before completion

## Payment invariants

- order cannot move to `paid` unless Stripe webhook confirms payment
- `payments.status` and `orders.paymentStatus` must stay aligned
- duplicate webhook events must be idempotent

## Delivery invariants

- final delivery status is always `delivered_to_lobby`
- no “delivered_to_unit” status exists, because the business rule disallows doorstep delivery

## Operational invariants

- only admins can edit slot capacity and pricing
- workers cannot mark delivery complete
- drivers cannot mark washing/drying/folding complete
- every status transition writes a row into `orderStatusHistory`

---

# 5. Read models you’ll likely need

Convex is great for reactive operational views, so design query shapes around screens.

## Customer screens

- my active orders
- order detail with status timeline
- available pickup/drop-off slots
- available delivery slots
- payment history
- saved addresses

## Worker screens

- my assigned laundry queue
- today’s in-progress processing
- issue-report list

## Driver screens

- my pickup tasks by slot
- my delivery tasks by slot
- task detail with building instructions

## Admin screens

- live order board by status
- slot capacity monitor
- daily revenue summary
- worker assignment board
- delivery punctuality report

This is where well-chosen indexes matter most, because Convex performance depends heavily on indexed query ranges rather than broad scans. ([docs.convex.dev][3])

---

# 6. Suggested implementation order

## Phase 1

Foundation tables:

- users
- addresses
- branches
- machines
- timeSlots

## Phase 2

Core commerce:

- orders
- orderStatusHistory
- payments

## Phase 3

Operations:

- workerAssignments
- deliveryTasks
- issueReports

## Phase 4

Comms and files:

- notifications
- attachments

## Phase 5

Derived dashboards / analytics rollups

---

# 7. Opinionated call-outs

Two design choices matter most here.

## Choice 1: `orders` should be the aggregate root

Do not split “customer order” and “laundry job” into separate main entities in v1.
That adds complexity too early.

## Choice 2: keep slot capacity in load-units

This is more faithful to your pricing and machine-availability model than simple order count.

---

# Practical summary

Use a Convex schema centered on:

- `orders` as the aggregate root
- `timeSlots` for capacity
- `payments` as Stripe mirror
- `deliveryTasks` and `workerAssignments` for intermediary users
- `orderStatusHistory` for auditability
- `attachments` for proof and issues

That schema is the cleanest fit for the user stories you already finalized.

[1]: https://docs.convex.dev/database/schemas?utm_source=chatgpt.com 'Schemas | Convex Developer Hub'
[2]: https://clerk.com/docs/guides/development/integrations/databases/convex?utm_source=chatgpt.com 'Integrate Convex with Clerk - Databases | Clerk Docs'
[3]: https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf?utm_source=chatgpt.com 'Introduction to Indexes and Query Performance'
[4]: https://docs.convex.dev/scheduling/scheduled-functions?utm_source=chatgpt.com 'Scheduled Functions | Convex Developer Hub'
[5]: https://docs.convex.dev/scheduling/cron-jobs?utm_source=chatgpt.com 'Cron Jobs | Convex Developer Hub'
[6]: https://docs.convex.dev/file-storage/upload-files?utm_source=chatgpt.com 'Uploading and Storing Files | Convex Developer Hub'
