import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserWithRoleOrThrow } from "./lib/auth";
import { appendOrderHistory } from "./lib/orderHistory";
import { isOperationallyAccessible } from "./lib/orderOperations";
import { orderStatusValidator } from "./lib/domain";

type OrderDoc = Doc<"orders">;
type IssueDoc = Doc<"issueReports">;

const workerSummaryValidator = v.object({
  _id: v.id("users"),
  fullName: v.string(),
  email: v.optional(v.string()),
});

const slotInfoValidator = v.object({
  slotId: v.id("timeSlots"),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
});

const queueItemValidator = v.object({
  _id: v.id("orders"),
  orderNumber: v.string(),
  currentStatus: orderStatusValidator,
  paymentStatus: v.string(),
  loadCount: v.number(),
  specialInstructions: v.optional(v.string()),
  customer: v.object({
    userId: v.id("users"),
    fullName: v.string(),
    phone: v.optional(v.string()),
  }),
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
  customer: v.object({
    userId: v.id("users"),
    fullName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }),
  assignedWorker: v.union(
    v.object({
      userId: v.id("users"),
      fullName: v.string(),
      email: v.optional(v.string()),
    }),
    v.null(),
  ),
  dropoffSlot: slotInfoValidator,
  deliverySlot: slotInfoValidator,
  address: v.object({
    label: v.string(),
    contactName: v.string(),
    contactPhone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    buildingName: v.string(),
    towerBlock: v.optional(v.string()),
    unitNumber: v.optional(v.string()),
    lobbyOrSecurityNote: v.string(),
  }),
  issueReports: v.array(
    v.object({
      _id: v.id("issueReports"),
      issueType: v.string(),
      description: v.string(),
      status: v.string(),
      resolutionNote: v.optional(v.string()),
      reporterName: v.string(),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      evidenceFiles: v.array(
        v.object({
          storageId: v.id("_storage"),
          url: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  statusHistory: v.array(
    v.object({
      _id: v.id("orderStatusHistory"),
      toStatus: orderStatusValidator,
      changeSource: v.string(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
});

function toSlotInfo(slot: {
  _id: Id<"timeSlots">;
  date: string;
  startTime: string;
  endTime: string;
}) {
  return {
    slotId: slot._id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  };
}

async function buildOperationalOrderDetail(
  ctx: Parameters<typeof getCurrentUserWithRoleOrThrow>[0],
  orderId: Id<"orders">,
) {
  const order = await ctx.db.get(orderId);

  if (!order) {
    throw new ConvexError("NOT_FOUND");
  }

  const [customer, assignedWorker, dropoffSlot, deliverySlot, address, statusHistory, issueReports] =
    await Promise.all([
      ctx.db.get(order.customerId),
      order.assignedWorkerId ? ctx.db.get(order.assignedWorkerId) : Promise.resolve(null),
      ctx.db.get(order.dropoffSlotId),
      ctx.db.get(order.deliverySlotId),
      ctx.db.get(order.addressId),
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

  if (!customer || !dropoffSlot || !deliverySlot || !address) {
    throw new ConvexError("ORDER_CONTEXT_MISSING");
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
    specialInstructions: order.specialInstructions,
    customer: {
      userId: customer._id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    },
    assignedWorker: assignedWorker
      ? {
          userId: assignedWorker._id,
          fullName: assignedWorker.fullName,
          email: assignedWorker.email,
        }
      : null,
    dropoffSlot: toSlotInfo(dropoffSlot),
    deliverySlot: toSlotInfo(deliverySlot),
    address: {
      label: address.label,
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      buildingName: address.buildingName,
      towerBlock: address.towerBlock,
      unitNumber: address.unitNumber,
      lobbyOrSecurityNote: address.lobbyOrSecurityNote,
    },
    issueReports: await Promise.all(
      issueReports.map(async (issue: IssueDoc) => {
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
    ),
    statusHistory: statusHistory.map((entry) => ({
      _id: entry._id,
      toStatus: entry.toStatus,
      changeSource: entry.changeSource,
      notes: entry.notes,
      createdAt: entry.createdAt,
    })),
  };
}

export const listAssignableWorkers = query({
  args: {},
  returns: v.array(workerSummaryValidator),
  handler: async (ctx) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const workers = await ctx.db
      .query("users")
      .withIndex("by_role", (db) => db.eq("role", "worker"))
      .collect();

    return workers
      .filter((worker) => worker.status === "active")
      .map((worker) => ({
        _id: worker._id,
        fullName: worker.fullName,
        email: worker.email,
      }));
  },
});

export const assignOrderToWorker = mutation({
  args: {
    orderId: v.id("orders"),
    workerId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const [order, worker] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.workerId),
    ]);

    if (!order || !worker) {
      throw new ConvexError("NOT_FOUND");
    }

    if (!worker || worker.role !== "worker" || worker.status !== "active") {
      throw new ConvexError("FORBIDDEN");
    }

    if (!order || !isOperationallyAccessible(order)) {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    const now = Date.now();
    await ctx.db.patch(order._id, {
      assignedWorkerId: worker._id,
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: order.currentStatus,
      toStatus: order.currentStatus,
      changeSource: "admin",
      notes: `Assigned to ${worker.fullName}.`,
      createdAt: now,
    });

    return null;
  },
});

export const listMyQueue = query({
  args: {},
  returns: v.array(queueItemValidator),
  handler: async (ctx) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["worker"]);
    const orders: OrderDoc[] = await ctx.db
      .query("orders")
      .withIndex("by_assigned_worker", (db) => db.eq("assignedWorkerId", user._id))
      .order("desc")
      .collect();

    const items = await Promise.all(
      orders
        .filter((order) => isOperationallyAccessible(order))
        .map(async (order) => {
          const [customer, dropoffSlot, issueReports] = await Promise.all([
            ctx.db.get(order.customerId),
            ctx.db.get(order.dropoffSlotId),
            ctx.db
              .query("issueReports")
              .withIndex("by_order", (db) => db.eq("orderId", order._id))
              .collect(),
          ]);

          if (!customer || !dropoffSlot) {
            throw new ConvexError("ORDER_CONTEXT_MISSING");
          }

          return {
            _id: order._id,
            orderNumber: order.orderNumber,
            currentStatus: order.currentStatus,
            paymentStatus: order.paymentStatus,
            loadCount: order.loadCount,
            specialInstructions: order.specialInstructions,
            customer: {
              userId: customer._id,
              fullName: customer.fullName,
              phone: customer.phone,
            },
            dropoffSlot: toSlotInfo(dropoffSlot),
            issueCountOpen: issueReports.filter((issue) => issue.status === "open").length,
          };
        }),
    );

    return items;
  },
});

export const getMyAssignedOrderDetail = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: operationalOrderDetailValidator,
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["worker"]);
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (order.assignedWorkerId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    return await buildOperationalOrderDetail(ctx, order._id);
  },
});
