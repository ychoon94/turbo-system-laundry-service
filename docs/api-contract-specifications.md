This is an **engineering-ready API contract** for the Convex backend, aligned to the validated user-story scope and constraints: customer ordering, worker processing, delivery to lobby/security desk only, admin operations, payment tracking, slot capacity, and analytics.

## Direct recommendation

For this stack, I would define the API contract as **Convex function contracts**, not a fake REST layer.

Use:

- **queries** for reads
- **mutations** for transactional writes
- **actions** for third-party calls like Stripe / email
- **HTTP actions** only for webhook entry points such as Stripe webhooks. Convex’s official model is exactly this: queries are reactive reads, mutations are transactional writes, actions handle network calls, and HTTP actions are for webhooks or custom HTTP access. ([docs.convex.dev][1])

That gives you the cleanest contract for React + Clerk + Convex.

---

# 1. API contract design principles

## 1.1 Contract style

Use this naming convention:

- `module.functionName`
- example: `orders.createDraftOrder`

Use these Convex function types:

- `query`: read-only, subscribable/reactive
- `mutation`: authenticated business writes
- `action`: external side effects
- `httpAction`: webhook receiver

Convex queries are automatically cached/subscribable, mutations are transactional, and actions are the place to call external services like Stripe. ([docs.convex.dev][1])

## 1.2 Auth model

Authentication source:

- Clerk session / JWT

Authorization source:

- Convex role checks using your app profile in `users`

Role matrix:

- customer
- worker
- driver
- admin

## 1.3 Response style

I recommend **typed domain objects**, not `{ ok: true }` wrappers everywhere.

Use:

- return the resource
- throw typed app errors for invalid actions

Example:

- success: return `OrderDetail`
- failure: throw `AppError("SLOT_FULL")`

This fits Convex better than REST-style envelopes.

---

# 2. Shared domain enums

These should be centralized in `convex/lib/domain.ts`.

## 2.1 Roles

```ts
type UserRole = 'customer' | 'worker' | 'driver' | 'admin';
```

## 2.2 Order status

```ts
type OrderStatus =
    | 'draft'
    | 'awaiting_payment'
    | 'paid'
    | 'awaiting_dropoff'
    | 'pickup_scheduled'
    | 'picked_up'
    | 'received_at_shop'
    | 'washing'
    | 'drying'
    | 'folding'
    | 'ready_for_delivery'
    | 'delivery_scheduled'
    | 'out_for_delivery'
    | 'delivered_to_lobby'
    | 'completed'
    | 'cancelled'
    | 'issue_hold';
```

## 2.3 Payment status

```ts
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
```

## 2.4 Slot type

```ts
type SlotType = 'dropoff' | 'pickup' | 'delivery';
```

## 2.5 Delivery task type

```ts
type DeliveryTaskType = 'pickup' | 'delivery';
```

## 2.6 Issue type

```ts
type IssueType = 'garment_damage' | 'machine_issue' | 'missing_item' | 'access_problem' | 'delay' | 'other';
```

---

# 3. Shared contract rules

## 3.1 Required invariants

- only one of `dropoffSlotId` or `pickupSlotId` can be set for intake
- `deliverySlotId` is required before delivery scheduling
- `reservedLoads <= capacityLoads`
- slot reservation uses `loadCount`
- final delivery status is `delivered_to_lobby`
- payment-confirmed status must come from Stripe webhook path, not frontend redirect
- every status change writes `orderStatusHistory`

These rules come directly from the validated business flow and constraints already captured in the user-story baseline.

## 3.2 Error codes

Define shared app errors:

```ts
type AppErrorCode =
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INVALID_STATE_TRANSITION'
    | 'SLOT_FULL'
    | 'SLOT_CLOSED'
    | 'PAYMENT_REQUIRED'
    | 'PAYMENT_ALREADY_COMPLETED'
    | 'INVALID_INPUT'
    | 'ISSUE_ALREADY_RESOLVED'
    | 'DELIVERY_ACCESS_PROBLEM'
    | 'WEBHOOK_SIGNATURE_INVALID'
    | 'CONFLICT_RETRY';
```

---

# 4. API contract by module

---

## 4.1 `auth/*`

These are helper contracts, usually internal.

### `auth.getCurrentUserProfile`

**Type:** `query`
**Actor:** authenticated user
**Purpose:** return app profile based on Clerk identity

**Args**

```ts
{
}
```

**Returns**

```ts
{
  userId: Id<"users">;
  clerkUserId: string;
  role: UserRole;
  fullName: string;
  branchId?: Id<"branches">;
}
```

### `auth.ensureCurrentUserProfile`

**Type:** `mutation`
**Actor:** authenticated user
**Purpose:** create/sync app profile after first sign-in

**Args**

```ts
{
  fullName?: string;
  email?: string;
  phone?: string;
}
```

**Returns**

```ts
{
    userId: Id<'users'>;
    role: UserRole;
}
```

---

## 4.2 `addresses/*`

### `addresses.listMyAddresses`

**Type:** `query`
**Actor:** customer

**Args**

```ts
{
}
```

**Returns**

```ts
AddressSummary[]
```

### `addresses.getAddress`

**Type:** `query`
**Actor:** customer/admin

**Args**

```ts
{
    addressId: Id<'addresses'>;
}
```

**Returns**

```ts
AddressDetail;
```

### `addresses.createAddress`

**Type:** `mutation`
**Actor:** customer

**Args**

```ts
{
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  postcode: string;
  city: string;
  state: string;
  buildingName: string;
  towerBlock?: string;
  unitNumber?: string;
  lobbyOrSecurityNote: string;
  accessInstructions?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}
```

**Returns**

```ts
{
    addressId: Id<'addresses'>;
}
```

### `addresses.updateAddress`

**Type:** `mutation`
**Actor:** customer

**Args**

```ts
{
  addressId: Id<"addresses">;
  patch: {
    label?: string;
    contactName?: string;
    contactPhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    postcode?: string;
    city?: string;
    state?: string;
    buildingName?: string;
    towerBlock?: string;
    unitNumber?: string;
    lobbyOrSecurityNote?: string;
    accessInstructions?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  };
}
```

**Returns**

```ts
{
    success: true;
}
```

### `addresses.deleteAddress`

**Type:** `mutation`
**Actor:** customer

**Args**

```ts
{
    addressId: Id<'addresses'>;
}
```

**Returns**

```ts
{
    success: true;
}
```

---

## 4.3 `slots/*`

### `slots.listAvailableSlots`

**Type:** `query`
**Actor:** customer/admin

**Args**

```ts
{
    branchId: Id<'branches'>;
    slotType: SlotType;
    dateFrom: string;
    dateTo: string;
    requiredLoads: number;
}
```

**Returns**

```ts
Array<{
    slotId: Id<'timeSlots'>;
    date: string;
    startTime: string;
    endTime: string;
    remainingLoads: number;
    cutoffMinutesBeforeStart: number;
}>;
```

### `slots.getSlot`

**Type:** `query`
**Actor:** customer/admin

**Args**

```ts
{
    slotId: Id<'timeSlots'>;
}
```

**Returns**

```ts
SlotDetail;
```

### `slots.createSlot`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
    branchId: Id<'branches'>;
    slotType: SlotType;
    date: string;
    startTime: string;
    endTime: string;
    capacityLoads: number;
    cutoffMinutesBeforeStart: number;
}
```

**Returns**

```ts
{
    slotId: Id<'timeSlots'>;
}
```

### `slots.updateSlot`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
  slotId: Id<"timeSlots">;
  patch: {
    startTime?: string;
    endTime?: string;
    capacityLoads?: number;
    status?: "open" | "closed" | "full";
    cutoffMinutesBeforeStart?: number;
  };
}
```

**Returns**

```ts
{
    success: true;
}
```

### `slots.reserveCapacityForDraftOrder`

**Type:** `mutation`
**Actor:** customer/system
**Purpose:** optional pre-check reservation strategy if you decide to hold slots before payment

**Args**

```ts
{
    slotId: Id<'timeSlots'>;
    loadCount: number;
    draftOrderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    remainingLoads: number;
}
```

### `slots.releaseCapacity`

**Type:** `mutation`
**Actor:** system/admin

**Args**

```ts
{
    slotId: Id<'timeSlots'>;
    loadCount: number;
    reason: 'payment_failed' | 'order_cancelled' | 'rescheduled';
}
```

**Returns**

```ts
{
    success: true;
}
```

### `slots.rescheduleOrderSlots`

**Type:** `mutation`
**Actor:** customer/admin

**Args**

```ts
{
  orderId: Id<"orders">;
  nextDropoffSlotId?: Id<"timeSlots">;
  nextPickupSlotId?: Id<"timeSlots">;
  nextDeliverySlotId?: Id<"timeSlots">;
}
```

**Returns**

```ts
{
    success: true;
    updatedOrderStatus: OrderStatus;
}
```

---

## 4.4 `orders/*`

### `orders.createDraftOrder`

**Type:** `mutation`
**Actor:** customer

**Args**

```ts
{
  branchId: Id<"branches">;
  serviceType: "self_dropoff" | "pickup_service";
  addressId: Id<"addresses">;
  loadCount: number;
  unitPriceSnapshot: number;
  specialInstructions?: string;
  dropoffSlotId?: Id<"timeSlots">;
  pickupSlotId?: Id<"timeSlots">;
  deliverySlotId: Id<"timeSlots">;
}
```

**Returns**

```ts
{
    orderId: Id<'orders'>;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: 'draft' | 'awaiting_payment';
}
```

### `orders.getMyOrders`

**Type:** `query`
**Actor:** customer

**Args**

```ts
{
  status?: OrderStatus;
  page?: {
    cursor?: string;
    limit: number;
  };
}
```

**Returns**

```ts
{
  items: OrderListItem[];
  nextCursor?: string;
}
```

### `orders.getMyOrderDetail`

**Type:** `query`
**Actor:** customer

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
CustomerOrderDetail;
```

### `orders.cancelDraftOrPendingOrder`

**Type:** `mutation`
**Actor:** customer/admin

**Args**

```ts
{
  orderId: Id<"orders">;
  reason?: string;
}
```

**Returns**

```ts
{
    success: true;
    status: 'cancelled';
}
```

### `orders.getAdminOrders`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  branchId?: Id<"branches">;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  serviceType?: "self_dropoff" | "pickup_service";
  assignedWorkerId?: Id<"users">;
  assignedDriverId?: Id<"users">;
  dateFrom?: string;
  dateTo?: string;
  page?: {
    cursor?: string;
    limit: number;
  };
}
```

**Returns**

```ts
{
  items: AdminOrderListItem[];
  nextCursor?: string;
}
```

### `orders.getAdminOrderDetail`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
AdminOrderDetail;
```

### `orders.markLaundryReceivedAtShop`

**Type:** `mutation`
**Actor:** worker/admin

**Args**

```ts
{
  orderId: Id<"orders">;
  note?: string;
}
```

**Returns**

```ts
{
    success: true;
    status: 'received_at_shop';
}
```

### `orders.startWashing`

**Type:** `mutation`
**Actor:** worker

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'washing';
    washingStartedAt: number;
}
```

### `orders.completeWashing`

**Type:** `mutation`
**Actor:** worker

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'drying';
    washingCompletedAt: number;
}
```

### `orders.completeDrying`

**Type:** `mutation`
**Actor:** worker

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'folding';
    dryingCompletedAt: number;
}
```

### `orders.completeFolding`

**Type:** `mutation`
**Actor:** worker

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'ready_for_delivery';
    foldingCompletedAt: number;
}
```

### `orders.putOnIssueHold`

**Type:** `mutation`
**Actor:** worker/admin

**Args**

```ts
{
    orderId: Id<'orders'>;
    issueReportId: Id<'issueReports'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'issue_hold';
}
```

### `orders.resumeFromIssueHold`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
  orderId: Id<"orders">;
  nextStatus: "washing" | "drying" | "folding" | "ready_for_delivery";
  note?: string;
}
```

**Returns**

```ts
{
    success: true;
    status: OrderStatus;
}
```

### `orders.markOutForDelivery`

**Type:** `mutation`
**Actor:** driver/admin

**Args**

```ts
{
    orderId: Id<'orders'>;
    deliveryTaskId: Id<'deliveryTasks'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'out_for_delivery';
    outForDeliveryAt: number;
}
```

### `orders.completeOrder`

**Type:** `mutation`
**Actor:** system/admin
**Purpose:** final close after successful delivery confirmation

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'completed';
    completedAt: number;
}
```

### `orders.getOrderTimeline`

**Type:** `query`
**Actor:** customer/worker/driver/admin with access checks

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
Array<{
    fromStatus?: OrderStatus;
    toStatus: OrderStatus;
    changedByUserId?: Id<'users'>;
    changeSource: 'customer' | 'worker' | 'driver' | 'admin' | 'system' | 'webhook';
    notes?: string;
    createdAt: number;
}>;
```

---

## 4.5 `payments/*`

### `payments.createCheckoutSession`

**Type:** `action`
**Actor:** customer
**Purpose:** call Stripe and create Checkout Session

**Args**

```ts
{
    orderId: Id<'orders'>;
    successUrl: string;
    cancelUrl: string;
}
```

**Returns**

```ts
{
    checkoutSessionId: string;
    checkoutUrl: string;
}
```

Actions are the correct Convex function type for external network calls such as Stripe. ([docs.convex.dev][1])

### `payments.getMyPayments`

**Type:** `query`
**Actor:** customer

**Args**

```ts
{
  page?: {
    cursor?: string;
    limit: number;
  };
}
```

**Returns**

```ts
{
  items: PaymentListItem[];
  nextCursor?: string;
}
```

### `payments.getOrderPayments`

**Type:** `query`
**Actor:** customer/admin

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
PaymentDetail[]
```

### `payments.refundPayment`

**Type:** `action`
**Actor:** admin
**Purpose:** optional v1.1 capability

**Args**

```ts
{
  orderId: Id<"orders">;
  amount?: number;
  reason?: string;
}
```

**Returns**

```ts
{
    success: true;
    refundId: string;
    paymentStatus: 'refunded' | 'partially_refunded';
}
```

### `payments.handleStripeWebhook`

**Type:** `httpAction`
**Actor:** Stripe
**Purpose:** verify signature, process payment events, update Convex state

**Input**

- raw `Request`
- Stripe signature header

**Returns**

- raw `Response`

HTTP actions in Convex are designed for receiving webhooks and can interact with your database indirectly via queries, mutations, or actions. ([docs.convex.dev][2])

**Supported events**

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

### `payments.syncPaymentResultInternal`

**Type:** `internalMutation`
**Actor:** system/webhook

**Args**

```ts
{
  orderId: Id<"orders">;
  providerCheckoutSessionId?: string;
  providerPaymentIntentId?: string;
  providerChargeId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  webhookEventId?: string;
  paidAt?: number;
  failedAt?: number;
  refundedAt?: number;
}
```

**Returns**

```ts
{
    success: true;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
}
```

---

## 4.6 `workers/*`

### `workers.listMyQueue`

**Type:** `query`
**Actor:** worker

**Args**

```ts
{
  status?: Extract<OrderStatus, "received_at_shop" | "washing" | "drying" | "folding" | "issue_hold">;
}
```

**Returns**

```ts
WorkerQueueItem[]
```

### `workers.assignOrderToWorker`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
    orderId: Id<'orders'>;
    workerId: Id<'users'>;
}
```

**Returns**

```ts
{
    success: true;
    assignmentId: Id<'workerAssignments'>;
}
```

### `workers.reassignOrderToWorker`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
  orderId: Id<"orders">;
  nextWorkerId: Id<"users">;
  reason?: string;
}
```

**Returns**

```ts
{
    success: true;
    assignmentId: Id<'workerAssignments'>;
}
```

### `workers.getWorkerAssignmentHistory`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
    orderId: Id<'orders'>;
}
```

**Returns**

```ts
WorkerAssignmentHistoryItem[]
```

---

## 4.7 `deliveries/*`

### `deliveries.listMyTasks`

**Type:** `query`
**Actor:** driver

**Args**

```ts
{
  taskType?: DeliveryTaskType;
  status?: "assigned" | "in_progress" | "completed" | "failed" | "cancelled";
  date?: string;
}
```

**Returns**

```ts
DriverTaskListItem[]
```

### `deliveries.assignTask`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
    orderId: Id<'orders'>;
    driverId: Id<'users'>;
    taskType: DeliveryTaskType;
    addressId: Id<'addresses'>;
    slotId: Id<'timeSlots'>;
}
```

**Returns**

```ts
{
    taskId: Id<'deliveryTasks'>;
}
```

### `deliveries.reassignTask`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
  taskId: Id<"deliveryTasks">;
  nextDriverId: Id<"users">;
  reason?: string;
}
```

**Returns**

```ts
{
    success: true;
}
```

### `deliveries.startTask`

**Type:** `mutation`
**Actor:** driver

**Args**

```ts
{
    taskId: Id<'deliveryTasks'>;
}
```

**Returns**

```ts
{
    success: true;
    status: 'in_progress';
    startedAt: number;
}
```

### `deliveries.completePickupTask`

**Type:** `mutation`
**Actor:** driver

**Args**

```ts
{
  taskId: Id<"deliveryTasks">;
  note?: string;
}
```

**Returns**

```ts
{
    success: true;
    taskStatus: 'completed';
    orderStatus: 'picked_up';
}
```

### `deliveries.completeDeliveryTask`

**Type:** `mutation`
**Actor:** driver

**Args**

```ts
{
  taskId: Id<"deliveryTasks">;
  proofAttachmentId?: Id<"attachments">;
  deliveredTo: "lobby" | "security_desk";
  note?: string;
}
```

**Returns**

```ts
{
    success: true;
    taskStatus: 'completed';
    orderStatus: 'delivered_to_lobby';
}
```

This explicitly encodes the “no doorstep delivery” rule from the product scope.

### `deliveries.failTask`

**Type:** `mutation`
**Actor:** driver/admin

**Args**

```ts
{
    taskId: Id<'deliveryTasks'>;
    reason: string;
}
```

**Returns**

```ts
{
    success: true;
    taskStatus: 'failed';
}
```

### `deliveries.getTaskDetail`

**Type:** `query`
**Actor:** driver/admin

**Args**

```ts
{
    taskId: Id<'deliveryTasks'>;
}
```

**Returns**

```ts
DriverTaskDetail;
```

---

## 4.8 `issues/*`

### `issues.createIssueReport`

**Type:** `mutation`
**Actor:** worker/driver/admin

**Args**

```ts
{
    orderId: Id<'orders'>;
    issueType: IssueType;
    description: string;
}
```

**Returns**

```ts
{
    issueReportId: Id<'issueReports'>;
    status: 'open';
}
```

### `issues.attachEvidenceToIssue`

**Type:** `mutation`
**Actor:** worker/driver/admin

**Args**

```ts
{
    issueReportId: Id<'issueReports'>;
    attachmentId: Id<'attachments'>;
}
```

**Returns**

```ts
{
    success: true;
}
```

### `issues.listIssues`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  status?: "open" | "under_review" | "resolved" | "dismissed";
  issueType?: IssueType;
  dateFrom?: string;
  dateTo?: string;
}
```

**Returns**

```ts
IssueListItem[]
```

### `issues.resolveIssue`

**Type:** `mutation`
**Actor:** admin

**Args**

```ts
{
    issueReportId: Id<'issueReports'>;
    resolutionNote: string;
}
```

**Returns**

```ts
{
    success: true;
    status: 'resolved';
}
```

---

## 4.9 `files/*`

### `files.generateUploadUrl`

**Type:** `mutation`
**Actor:** authenticated user

**Args**

```ts
{
}
```

**Returns**

```ts
{
    uploadUrl: string;
}
```

Convex file upload uses the standard flow of generating an upload URL, posting the file body to that URL, receiving a storage ID, and then saving that storage ID in your own data model. ([docs.convex.dev][3])

### `files.createAttachmentRecord`

**Type:** `mutation`
**Actor:** authenticated user

**Args**

```ts
{
  storageId: string;
  entityType: "issue_report" | "delivery_task" | "order";
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}
```

**Returns**

```ts
{
    attachmentId: Id<'attachments'>;
}
```

### `files.getAttachmentUrl`

**Type:** `query`
**Actor:** authenticated user with access check

**Args**

```ts
{
    attachmentId: Id<'attachments'>;
}
```

**Returns**

```ts
{
    url: string | null;
}
```

Convex supports serving stored files by generating URLs from storage-backed files. ([docs.convex.dev][4])

---

## 4.10 `notifications/*`

### `notifications.listMyNotifications`

**Type:** `query`
**Actor:** authenticated user

**Args**

```ts
{
  page?: {
    cursor?: string;
    limit: number;
  };
}
```

**Returns**

```ts
{
  items: NotificationItem[];
  nextCursor?: string;
}
```

### `notifications.markAsRead`

**Type:** `mutation`
**Actor:** authenticated user

**Args**

```ts
{
    notificationId: Id<'notifications'>;
}
```

**Returns**

```ts
{
    success: true;
}
```

### `notifications.scheduleOrderReminder`

**Type:** `internalAction` or `internalMutation`
**Actor:** system

**Args**

```ts
{
    orderId: Id<'orders'>;
    reminderType: 'pickup' | 'dropoff' | 'delivery';
    runAt: number;
}
```

**Returns**

```ts
{
    success: true;
}
```

Convex scheduled functions can be queued from mutations/actions using `runAfter` or `runAt`, and Convex also supports recurring cron jobs. ([docs.convex.dev][5])

### `notifications.sendEmailNow`

**Type:** `internalAction`
**Actor:** system

**Args**

```ts
{
    userId: Id<'users'>;
    templateKey: string;
    payload: Record<string, unknown>;
}
```

**Returns**

```ts
{
  success: true;
  providerMessageId?: string;
}
```

---

## 4.11 `analytics/*`

### `analytics.getAdminDashboardSummary`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  branchId?: Id<"branches">;
  dateFrom?: string;
  dateTo?: string;
}
```

**Returns**

```ts
{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    revenueAmount: number;
    pendingPayments: number;
    issueCountOpen: number;
}
```

### `analytics.getOrderVolumeTrend`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  branchId?: Id<"branches">;
  dateFrom: string;
  dateTo: string;
  interval: "day" | "week" | "month";
}
```

**Returns**

```ts
Array<{
    bucket: string;
    orderCount: number;
    loadCount: number;
}>;
```

### `analytics.getPaymentSummary`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  branchId?: Id<"branches">;
  dateFrom: string;
  dateTo: string;
}
```

**Returns**

```ts
{
    paidAmount: number;
    refundedAmount: number;
    failedCount: number;
    paidCount: number;
}
```

### `analytics.getDeliveryPerformance`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  dateFrom: string;
  dateTo: string;
  driverId?: Id<"users">;
}
```

**Returns**

```ts
{
    completedDeliveries: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    failedDeliveries: number;
}
```

### `analytics.getWorkerThroughput`

**Type:** `query`
**Actor:** admin

**Args**

```ts
{
  dateFrom: string;
  dateTo: string;
  workerId?: Id<"users">;
}
```

**Returns**

```ts
{
  processedOrders: number;
  avgProcessingMinutes?: number;
  issueCount: number;
}
```

---

# 5. Internal-only contracts

These should not be callable directly from the client.

## `orders.transitionStateInternal`

**Type:** `internalMutation`

**Args**

```ts
{
  orderId: Id<"orders">;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  changedByUserId?: Id<"users">;
  changeSource: "customer" | "worker" | "driver" | "admin" | "system" | "webhook";
  notes?: string;
  timestamps?: Partial<{
    paidAt: number;
    receivedAtShopAt: number;
    washingStartedAt: number;
    washingCompletedAt: number;
    dryingCompletedAt: number;
    foldingCompletedAt: number;
    outForDeliveryAt: number;
    deliveredAt: number;
    completedAt: number;
    cancelledAt: number;
  }>;
}
```

**Returns**

```ts
{
    success: true;
    status: OrderStatus;
}
```

## `slots.adjustReservationInternal`

**Type:** `internalMutation`

**Args**

```ts
{
    slotId: Id<'timeSlots'>;
    deltaLoads: number;
}
```

**Returns**

```ts
{
    reservedLoads: number;
    remainingLoads: number;
}
```

## `notifications.enqueueDomainEventInternal`

**Type:** `internalMutation`

**Args**

```ts
{
  orderId: Id<"orders">;
  eventName:
    | "OrderPlaced"
    | "PaymentConfirmed"
    | "LaundryReceived"
    | "WashStarted"
    | "WashCompleted"
    | "DryCompleted"
    | "FoldCompleted"
    | "DeliveryAssigned"
    | "OutForDelivery"
    | "Delivered"
    | "OrderCompleted";
  payload?: Record<string, unknown>;
}
```

**Returns**

```ts
{
    success: true;
}
```

---

# 6. Suggested frontend-to-backend mapping

## Customer app

- `auth.getCurrentUserProfile`
- `addresses.listMyAddresses`
- `addresses.createAddress`
- `slots.listAvailableSlots`
- `orders.createDraftOrder`
- `payments.createCheckoutSession`
- `orders.getMyOrders`
- `orders.getMyOrderDetail`
- `payments.getMyPayments`
- `notifications.listMyNotifications`

## Worker app

- `workers.listMyQueue`
- `orders.markLaundryReceivedAtShop`
- `orders.startWashing`
- `orders.completeWashing`
- `orders.completeDrying`
- `orders.completeFolding`
- `issues.createIssueReport`

## Driver app

- `deliveries.listMyTasks`
- `deliveries.startTask`
- `deliveries.completePickupTask`
- `deliveries.completeDeliveryTask`
- `deliveries.failTask`
- `files.generateUploadUrl`
- `files.createAttachmentRecord`

## Admin app

- `orders.getAdminOrders`
- `orders.getAdminOrderDetail`
- `workers.assignOrderToWorker`
- `deliveries.assignTask`
- `slots.createSlot`
- `slots.updateSlot`
- `analytics.getAdminDashboardSummary`
- `analytics.getPaymentSummary`

---

# 7. Implementation notes for Convex

## 7.1 Validators

Convex recommends validators for queries, mutations, and actions, and suggests validating HTTP action request shapes as well. ([docs.convex.dev][6])

## 7.2 Scheduled reminders

Use:

- `runAt` for slot reminders
- cron for recurring housekeeping / rollups

Convex explicitly supports both delayed scheduled functions and recurring cron jobs. ([docs.convex.dev][5])

## 7.3 File uploads

Use the 3-step Convex upload pattern:

1. generate upload URL
2. client uploads file body
3. save returned `storageId` into `attachments`

That is the official Convex file upload flow. ([docs.convex.dev][3])

---

# 8. Practical build order

## Phase 1

Foundation contract

- auth
- addresses
- slots
- orders.createDraftOrder
- payments.createCheckoutSession
- payments.handleStripeWebhook

## Phase 2

Customer tracking

- getMyOrders
- getMyOrderDetail
- notifications
- payments history

## Phase 3

Worker operations

- worker queue
- laundry state transitions
- issue reporting

## Phase 4

Driver operations

- delivery tasks
- pickup confirmation
- delivery completion
- proof uploads

## Phase 5

Admin operations

- order board
- slot management
- staff assignment
- analytics

---

# Practical summary

For v1, I would implement roughly **35–40 Convex contracts** split across:

- `auth`
- `addresses`
- `slots`
- `orders`
- `payments`
- `workers`
- `deliveries`
- `issues`
- `files`
- `notifications`
- `analytics`

The most important contracts to build first are:

- `orders.createDraftOrder`
- `slots.listAvailableSlots`
- `payments.createCheckoutSession`
- `payments.handleStripeWebhook`
- `orders.getMyOrders`
- `workers.listMyQueue`
- `deliveries.listMyTasks`
- `deliveries.completeDeliveryTask`

That set gets your entire end-to-end business flow moving while staying faithful to the validated product scope.

[1]: https://docs.convex.dev/functions?utm_source=chatgpt.com 'Functions | Convex Developer Hub'
[2]: https://docs.convex.dev/functions/http-actions?utm_source=chatgpt.com 'HTTP Actions | Convex Developer Hub'
[3]: https://docs.convex.dev/file-storage/upload-files?utm_source=chatgpt.com 'Uploading and Storing Files | Convex Developer Hub'
[4]: https://docs.convex.dev/file-storage?utm_source=chatgpt.com 'File Storage | Convex Developer Hub'
[5]: https://docs.convex.dev/scheduling/scheduled-functions?utm_source=chatgpt.com 'Scheduled Functions - Convex Developer Hub'
[6]: https://docs.convex.dev/understanding/best-practices/?utm_source=chatgpt.com 'Best Practices | Convex Developer Hub'
