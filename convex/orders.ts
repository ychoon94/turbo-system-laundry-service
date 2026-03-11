import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { getCurrentUserOrThrow, getCurrentUserWithRoleOrThrow } from "./lib/auth";
import {
  HOLD_TTL_MS,
  buildOrderNumber,
  issueStatusValidator,
  issueTypeValidator,
  orderStatusValidator,
} from "./lib/domain";
import { appendOrderHistory } from "./lib/orderHistory";
import {
  canResumeFromIssueHold,
  canTransitionToIssueHold,
  getExpectedNextOperationalStatus,
  isAssignedToWorker,
  isOperationallyAccessible,
} from "./lib/orderOperations";
import { calculateOrderTotals, getRemainingLoads, isHoldActive } from "./lib/orderRules";
import { reserveOrderSlots } from "./lib/slotReservations";

type OrderDoc = Doc<"orders">;
type UserDoc = Doc<"users">;
type AddressDoc = Doc<"addresses">;
type SlotDoc = Doc<"timeSlots">;
type IssueReportDoc = Doc<"issueReports">;

const slotInfoValidator = v.object({
  slotId: v.id("timeSlots"),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
});

const addressInfoValidator = v.object({
  label: v.string(),
  contactName: v.string(),
  contactPhone: v.string(),
  addressLine1: v.string(),
  addressLine2: v.optional(v.string()),
  buildingName: v.string(),
  towerBlock: v.optional(v.string()),
  unitNumber: v.optional(v.string()),
  lobbyOrSecurityNote: v.string(),
});

const reorderDefaultsValidator = v.object({
  orderId: v.id("orders"),
  addressId: v.optional(v.id("addresses")),
  loadCount: v.number(),
  specialInstructions: v.optional(v.string()),
  dropoffSlotId: v.optional(v.id("timeSlots")),
  deliverySlotId: v.optional(v.id("timeSlots")),
  dropoffSlotReusable: v.boolean(),
  deliverySlotReusable: v.boolean(),
  dropoffSlotMessage: v.optional(v.string()),
  deliverySlotMessage: v.optional(v.string()),
});

const workerSummaryValidator = v.object({
  userId: v.id("users"),
  fullName: v.string(),
  email: v.optional(v.string()),
});

const customerSummaryValidator = v.object({
  userId: v.id("users"),
  fullName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
});

const issueEvidenceValidator = v.object({
  storageId: v.id("_storage"),
  url: v.union(v.string(), v.null()),
});

const issueSummaryValidator = v.object({
  _id: v.id("issueReports"),
  issueType: issueTypeValidator,
  description: v.string(),
  status: issueStatusValidator,
  resolutionNote: v.optional(v.string()),
  reporterName: v.string(),
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
  evidenceFiles: v.array(issueEvidenceValidator),
});

const statusHistoryValidator = v.object({
  _id: v.id("orderStatusHistory"),
  toStatus: orderStatusValidator,
  changeSource: v.string(),
  notes: v.optional(v.string()),
  createdAt: v.number(),
});

const adminOrderListItemValidator = v.object({
  _id: v.id("orders"),
  orderNumber: v.string(),
  currentStatus: orderStatusValidator,
  paymentStatus: v.string(),
  loadCount: v.number(),
  totalAmount: v.number(),
  currency: v.string(),
  createdAt: v.number(),
  customer: v.object({
    userId: v.id("users"),
    fullName: v.string(),
    email: v.optional(v.string()),
  }),
  assignedWorker: v.union(workerSummaryValidator, v.null()),
  dropoffSlot: slotInfoValidator,
  issueCountOpen: v.number(),
});

const operationalOrderDetailValidator = v.object({
  _id: v.id("orders"),
  orderNumber: v.string(),
  currentStatus: orderStatusValidator,
  paymentStatus: v.string(),
  loadCount: v.number(),
  totalAmount: v.number(),
  currency: v.string(),
  createdAt: v.number(),
  specialInstructions: v.optional(v.string()),
  customer: customerSummaryValidator,
  assignedWorker: v.union(workerSummaryValidator, v.null()),
  dropoffSlot: slotInfoValidator,
  deliverySlot: slotInfoValidator,
  address: addressInfoValidator,
  issueReports: v.array(issueSummaryValidator),
  statusHistory: v.array(statusHistoryValidator),
});

function isTerminalPaymentStatus(paymentStatus: string) {
  return paymentStatus === "paid" || paymentStatus === "failed" || paymentStatus === "refunded";
}

function getReusableSlotState(
  slot:
    | {
        _id: Id<"timeSlots">;
        status: string;
        capacityLoads: number;
        reservedLoads?: number;
      }
    | null,
  loadCount: number,
  label: string,
) {
  if (!slot) {
    return {
      reusable: false,
      message: `The original ${label} slot is no longer available.`,
    };
  }

  if (slot.status === "closed") {
    return {
      reusable: false,
      message: `The original ${label} slot is closed. Choose a new one.`,
    };
  }

  const remainingLoads = getRemainingLoads(slot.capacityLoads, slot.reservedLoads ?? 0);
  if (remainingLoads < loadCount) {
    return {
      reusable: false,
      message: `The original ${label} slot no longer has enough capacity.`,
    };
  }

  return {
    reusable: true,
    message: undefined,
  };
}

function getActorChangeSource(role: UserDoc["role"]) {
  return role === "admin" ? "admin" : "worker";
}

async function loadRequiredOrderContext(
  ctx: {
    db: {
      get: <TableName extends TableNames>(
        id: Id<TableName>,
      ) => Promise<Doc<TableName> | null>;
    };
  },
  order: OrderDoc,
) {
  const [customer, assignedWorker, dropoffSlot, deliverySlot, address] = await Promise.all([
    ctx.db.get(order.customerId),
    order.assignedWorkerId ? ctx.db.get(order.assignedWorkerId) : Promise.resolve(null),
    ctx.db.get(order.dropoffSlotId),
    ctx.db.get(order.deliverySlotId),
    ctx.db.get(order.addressId),
  ]);

  if (!customer || !dropoffSlot || !deliverySlot || !address) {
    throw new ConvexError("ORDER_CONTEXT_MISSING");
  }

  return {
    customer,
    assignedWorker,
    dropoffSlot,
    deliverySlot,
    address,
  };
}

function toWorkerSummary(worker: UserDoc | null) {
  return worker
    ? {
        userId: worker._id,
        fullName: worker.fullName,
        email: worker.email,
      }
    : null;
}

function toCustomerSummary(customer: UserDoc) {
  return {
    userId: customer._id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
  };
}

function toSlotInfo(slot: SlotDoc) {
  return {
    slotId: slot._id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  };
}

function toAddressInfo(address: AddressDoc) {
  return {
    label: address.label,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    buildingName: address.buildingName,
    towerBlock: address.towerBlock,
    unitNumber: address.unitNumber,
    lobbyOrSecurityNote: address.lobbyOrSecurityNote,
  };
}

async function buildIssueSummaries(
  ctx: {
    db: {
      get: <TableName extends TableNames>(
        id: Id<TableName>,
      ) => Promise<Doc<TableName> | null>;
    };
    storage: {
      getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
    };
  },
  issues: IssueReportDoc[],
) {
  return await Promise.all(
    issues.map(async (issue) => {
      const reporter = await ctx.db.get(issue.reporterId);
      const evidenceFiles = await Promise.all(
        issue.evidenceFileIds.map(async (storageId) => ({
          storageId,
          url: await ctx.storage.getUrl(storageId),
        })),
      );

      return {
        _id: issue._id,
        issueType: issue.issueType,
        description: issue.description,
        status: issue.status,
        resolutionNote: issue.resolutionNote,
        reporterName: reporter?.fullName ?? "Unknown reporter",
        createdAt: issue.createdAt,
        resolvedAt: issue.resolvedAt,
        evidenceFiles,
      };
    }),
  );
}

async function buildOperationalOrderDetail(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  order: OrderDoc,
) {
  const [{ customer, assignedWorker, dropoffSlot, deliverySlot, address }, statusHistory, issueReports] =
    await Promise.all([
      loadRequiredOrderContext(ctx, order),
      ctx.db
        .query("orderStatusHistory")
        .withIndex("by_order", (db) => db.eq("orderId", order._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("issueReports")
        .withIndex("by_order", (db) => db.eq("orderId", order._id))
        .order("desc")
        .collect(),
    ]);

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    currentStatus: order.currentStatus,
    paymentStatus: order.paymentStatus,
    loadCount: order.loadCount,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    specialInstructions: order.specialInstructions,
    customer: toCustomerSummary(customer),
    assignedWorker: toWorkerSummary(assignedWorker),
    dropoffSlot: toSlotInfo(dropoffSlot),
    deliverySlot: toSlotInfo(deliverySlot),
    address: toAddressInfo(address),
    issueReports: await buildIssueSummaries(ctx, issueReports),
    statusHistory: statusHistory.map((entry) => ({
      _id: entry._id,
      toStatus: entry.toStatus,
      changeSource: entry.changeSource,
      notes: entry.notes,
      createdAt: entry.createdAt,
    })),
  };
}

async function transitionOperationalOrder(
  ctx: MutationCtx,
  args: {
    orderId: Id<"orders">;
    allowedRoles: Array<"worker" | "admin">;
    expectedCurrentStatus: OrderDoc["currentStatus"];
    note: string;
    patch?: Partial<OrderDoc>;
  },
) {
  const { user } = await getCurrentUserWithRoleOrThrow(ctx, args.allowedRoles);
  const order = await ctx.db.get(args.orderId);

  if (!order) {
    throw new ConvexError("NOT_FOUND");
  }

  if (!isOperationallyAccessible(order) || order.currentStatus !== args.expectedCurrentStatus) {
    throw new ConvexError("INVALID_STATE_TRANSITION");
  }

  if (user.role === "worker" && !isAssignedToWorker(order, user._id)) {
    throw new ConvexError("FORBIDDEN");
  }

  const nextStatus = getExpectedNextOperationalStatus(order.currentStatus);

  if (!nextStatus) {
    throw new ConvexError("INVALID_STATE_TRANSITION");
  }

  const now = Date.now();
  await ctx.db.patch(order._id, {
    ...args.patch,
    currentStatus: nextStatus,
    updatedAt: now,
  });

  await appendOrderHistory(ctx, {
    orderId: order._id,
    fromStatus: order.currentStatus,
    toStatus: nextStatus,
    changeSource: getActorChangeSource(user.role),
    notes: args.note,
    createdAt: now,
  });

  return null;
}

export const createDraftOrder = mutation({
  args: {
    addressId: v.id("addresses"),
    loadCount: v.number(),
    dropoffSlotId: v.id("timeSlots"),
    deliverySlotId: v.id("timeSlots"),
    specialInstructions: v.optional(v.string()),
  },
  returns: v.object({
    orderId: v.id("orders"),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const now = Date.now();

    if (!user.branchId) {
      throw new ConvexError("BRANCH_NOT_READY");
    }

    const branch = await ctx.db.get(user.branchId);
    const address = await ctx.db.get(args.addressId);

    if (!branch || !address) {
      throw new ConvexError("NOT_FOUND");
    }

    if (address.userId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    await reserveOrderSlots(ctx, {
      branchId: branch._id,
      dropoffSlotId: args.dropoffSlotId,
      deliverySlotId: args.deliverySlotId,
      loadCount: args.loadCount,
      updatedAt: now,
    });

    const totals = calculateOrderTotals(args.loadCount, branch.pricePerLoad);
    const holdExpiresAt = now + HOLD_TTL_MS;
    const orderId = await ctx.db.insert("orders", {
      orderNumber: buildOrderNumber(now),
      customerId: user._id,
      branchId: branch._id,
      serviceType: "self_dropoff",
      dropoffSlotId: args.dropoffSlotId,
      deliverySlotId: args.deliverySlotId,
      addressId: args.addressId,
      loadCount: args.loadCount,
      unitPriceSnapshot: branch.pricePerLoad,
      subtotalAmount: totals.subtotalAmount,
      totalAmount: totals.totalAmount,
      currency: branch.currency,
      specialInstructions: args.specialInstructions,
      currentStatus: "draft",
      paymentStatus: "pending",
      holdExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId,
      toStatus: "draft",
      changeSource: "customer",
      createdAt: now,
      notes: "Draft order created with a timed slot hold.",
    });

    await ctx.scheduler.runAfter(HOLD_TTL_MS, internal.payments.releaseExpiredHold, {
      orderId,
    });

    return { orderId };
  },
});

export const getMyOrders = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("orders"),
      orderNumber: v.string(),
      currentStatus: v.string(),
      paymentStatus: v.string(),
      totalAmount: v.number(),
      currency: v.string(),
      holdExpired: v.boolean(),
      holdExpiresAt: v.optional(v.number()),
      dropoffSlot: slotInfoValidator,
      deliverySlot: slotInfoValidator,
    }),
  ),
  handler: async (ctx) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer", (db) => db.eq("customerId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      orders.map(async (order) => {
        const dropoffSlot = await ctx.db.get(order.dropoffSlotId);
        const deliverySlot = await ctx.db.get(order.deliverySlotId);

        if (!dropoffSlot || !deliverySlot) {
          throw new ConvexError("ORDER_SLOT_MISSING");
        }

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          currentStatus: order.currentStatus,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          currency: order.currency,
          holdExpired:
            !isHoldActive(order.holdExpiresAt, now) &&
            !isTerminalPaymentStatus(order.paymentStatus),
          holdExpiresAt: order.holdExpiresAt,
          dropoffSlot: toSlotInfo(dropoffSlot),
          deliverySlot: toSlotInfo(deliverySlot),
        };
      }),
    );
  },
});

export const getMyOrderDetail = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({
    _id: v.id("orders"),
    orderNumber: v.string(),
    currentStatus: v.string(),
    paymentStatus: v.string(),
    loadCount: v.number(),
    totalAmount: v.number(),
    currency: v.string(),
    holdExpired: v.boolean(),
    holdExpiresAt: v.optional(v.number()),
    specialInstructions: v.optional(v.string()),
    paymentSessionId: v.optional(v.string()),
    dropoffSlot: slotInfoValidator,
    deliverySlot: slotInfoValidator,
    address: addressInfoValidator,
    statusHistory: v.array(
      v.object({
        _id: v.id("orderStatusHistory"),
        toStatus: v.string(),
        notes: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (order.customerId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    const [{ dropoffSlot, deliverySlot, address }, statusHistory] = await Promise.all([
      loadRequiredOrderContext(ctx, order),
      ctx.db
        .query("orderStatusHistory")
        .withIndex("by_order", (db) => db.eq("orderId", order._id))
        .order("desc")
        .collect(),
    ]);

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      currentStatus: order.currentStatus,
      paymentStatus: order.paymentStatus,
      loadCount: order.loadCount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      holdExpired:
        !isHoldActive(order.holdExpiresAt, now) &&
        !isTerminalPaymentStatus(order.paymentStatus),
      holdExpiresAt: order.holdExpiresAt,
      specialInstructions: order.specialInstructions,
      paymentSessionId: order.paymentSessionId,
      dropoffSlot: toSlotInfo(dropoffSlot),
      deliverySlot: toSlotInfo(deliverySlot),
      address: toAddressInfo(address),
      statusHistory: statusHistory.map((entry) => ({
        _id: entry._id,
        toStatus: entry.toStatus,
        notes: entry.notes,
        createdAt: entry.createdAt,
      })),
    };
  },
});

export const getReorderDefaults = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.union(v.null(), reorderDefaultsValidator),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (order.customerId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    if (order.currentStatus !== "cancelled" || !["failed", "refunded"].includes(order.paymentStatus)) {
      return null;
    }

    const [address, dropoffSlot, deliverySlot] = await Promise.all([
      ctx.db.get(order.addressId),
      ctx.db.get(order.dropoffSlotId),
      ctx.db.get(order.deliverySlotId),
    ]);

    const dropoffState = getReusableSlotState(dropoffSlot, order.loadCount, "drop-off");
    const deliveryState = getReusableSlotState(deliverySlot, order.loadCount, "delivery");

    return {
      orderId: order._id,
      addressId: address?._id,
      loadCount: order.loadCount,
      specialInstructions: order.specialInstructions,
      dropoffSlotId: dropoffState.reusable ? order.dropoffSlotId : undefined,
      deliverySlotId: deliveryState.reusable ? order.deliverySlotId : undefined,
      dropoffSlotReusable: dropoffState.reusable,
      deliverySlotReusable: deliveryState.reusable,
      dropoffSlotMessage: dropoffState.message,
      deliverySlotMessage: deliveryState.message,
    };
  },
});

export const getAdminOrders = query({
  args: {
    status: v.optional(orderStatusValidator),
    assignedWorkerId: v.optional(v.id("users")),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: v.array(adminOrderListItemValidator),
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);

    const searchText = args.search?.trim().toLowerCase();
    const orders = await ctx.db.query("orders").order("desc").collect();
    const visibleOrders = orders.filter(
      (order) =>
        isOperationallyAccessible(order) &&
        (args.status ? order.currentStatus === args.status : true) &&
        (args.assignedWorkerId ? order.assignedWorkerId === args.assignedWorkerId : true),
    );

    const items = await Promise.all(
      visibleOrders.map(async (order) => {
        const [{ customer, assignedWorker, dropoffSlot }, issueReports] = await Promise.all([
          loadRequiredOrderContext(ctx, order),
          ctx.db
            .query("issueReports")
            .withIndex("by_order", (db) => db.eq("orderId", order._id))
            .collect(),
        ]);

        if (args.dateFrom && dropoffSlot.date < args.dateFrom) {
          return null;
        }

        if (args.dateTo && dropoffSlot.date > args.dateTo) {
          return null;
        }

        if (searchText) {
          const haystack = [order.orderNumber, customer.fullName, customer.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(searchText)) {
            return null;
          }
        }

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          currentStatus: order.currentStatus,
          paymentStatus: order.paymentStatus,
          loadCount: order.loadCount,
          totalAmount: order.totalAmount,
          currency: order.currency,
          createdAt: order.createdAt,
          customer: {
            userId: customer._id,
            fullName: customer.fullName,
            email: customer.email,
          },
          assignedWorker: toWorkerSummary(assignedWorker),
          dropoffSlot: toSlotInfo(dropoffSlot),
          issueCountOpen: issueReports.filter((issue) => issue.status === "open").length,
        };
      }),
    );

    return items.filter((item): item is NonNullable<typeof item> => item !== null);
  },
});

export const getAdminOrderDetail = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: operationalOrderDetailValidator,
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (!isOperationallyAccessible(order)) {
      throw new ConvexError("NOT_FOUND");
    }

    return await buildOperationalOrderDetail(ctx, order);
  },
});

export const markLaundryReceivedAtShop = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await transitionOperationalOrder(ctx, {
      orderId: args.orderId,
      allowedRoles: ["worker", "admin"],
      expectedCurrentStatus: "awaiting_dropoff",
      note: "Laundry received at the shop.",
      patch: {
        receivedAtShopAt: Date.now(),
      },
    });
  },
});

export const startWashing = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await transitionOperationalOrder(ctx, {
      orderId: args.orderId,
      allowedRoles: ["worker"],
      expectedCurrentStatus: "received_at_shop",
      note: "Worker started washing.",
      patch: {
        washingStartedAt: Date.now(),
      },
    });
  },
});

export const completeWashing = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await transitionOperationalOrder(ctx, {
      orderId: args.orderId,
      allowedRoles: ["worker"],
      expectedCurrentStatus: "washing",
      note: "Washing completed and drying started.",
      patch: {
        washingCompletedAt: Date.now(),
      },
    });
  },
});

export const completeDrying = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await transitionOperationalOrder(ctx, {
      orderId: args.orderId,
      allowedRoles: ["worker"],
      expectedCurrentStatus: "drying",
      note: "Drying completed and folding started.",
      patch: {
        dryingCompletedAt: Date.now(),
      },
    });
  },
});

export const completeFolding = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await transitionOperationalOrder(ctx, {
      orderId: args.orderId,
      allowedRoles: ["worker"],
      expectedCurrentStatus: "folding",
      note: "Folding completed. Order is ready for delivery scheduling.",
      patch: {
        foldingCompletedAt: Date.now(),
        readyForDeliveryAt: Date.now(),
      },
    });
  },
});

export const putOnIssueHold = mutation({
  args: {
    orderId: v.id("orders"),
    issueReportId: v.id("issueReports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["worker", "admin"]);
    const [order, issueReport] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.issueReportId),
    ]);

    if (!order || !issueReport) {
      throw new ConvexError("NOT_FOUND");
    }

    if (issueReport.orderId !== order._id || issueReport.status !== "open") {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    if (!canTransitionToIssueHold(order.currentStatus) || !isOperationallyAccessible(order)) {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    if (user.role === "worker" && !isAssignedToWorker(order, user._id)) {
      throw new ConvexError("FORBIDDEN");
    }

    const now = Date.now();
    await ctx.db.patch(order._id, {
      currentStatus: "issue_hold",
      issueHoldAt: now,
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: order.currentStatus,
      toStatus: "issue_hold",
      changeSource: getActorChangeSource(user.role),
      notes: `Issue reported: ${issueReport.issueType.replaceAll("_", " ")}.`,
      createdAt: now,
    });

    return null;
  },
});

export const resumeFromIssueHold = mutation({
  args: {
    orderId: v.id("orders"),
    issueReportId: v.id("issueReports"),
    nextStatus: v.union(
      v.literal("washing"),
      v.literal("drying"),
      v.literal("folding"),
      v.literal("ready_for_delivery"),
    ),
    resolutionNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const [order, issueReport] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.issueReportId),
    ]);

    if (!order || !issueReport) {
      throw new ConvexError("NOT_FOUND");
    }

    if (
      order.currentStatus !== "issue_hold" ||
      issueReport.orderId !== order._id ||
      issueReport.status !== "open" ||
      !canResumeFromIssueHold(args.nextStatus)
    ) {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    const now = Date.now();
    await ctx.db.patch(issueReport._id, {
      status: "resolved",
      resolutionNote: args.resolutionNote,
      resolvedAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(order._id, {
      currentStatus: args.nextStatus,
      readyForDeliveryAt:
        args.nextStatus === "ready_for_delivery" ? now : order.readyForDeliveryAt,
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: "issue_hold",
      toStatus: args.nextStatus,
      changeSource: "admin",
      notes: args.resolutionNote ?? "Admin resolved the issue and resumed processing.",
      createdAt: now,
    });

    return null;
  },
});
