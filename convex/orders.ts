import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./lib/auth";
import { appendOrderHistory } from "./lib/orderHistory";
import { buildOrderNumber } from "./lib/domain";
import {
  calculateOrderTotals,
  hasSufficientCapacity,
} from "./lib/orderRules";

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
    const dropoffSlot = await ctx.db.get(args.dropoffSlotId);
    const deliverySlot = await ctx.db.get(args.deliverySlotId);

    if (!branch || !address || !dropoffSlot || !deliverySlot) {
      throw new ConvexError("NOT_FOUND");
    }

    if (address.userId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    if (
      dropoffSlot.slotType !== "dropoff" ||
      deliverySlot.slotType !== "delivery" ||
      dropoffSlot.branchId !== branch._id ||
      deliverySlot.branchId !== branch._id
    ) {
      throw new ConvexError("INVALID_SLOT_SELECTION");
    }

    await assertSlotCapacity(ctx, args.dropoffSlotId, "dropoff", args.loadCount, now);
    await assertSlotCapacity(
      ctx,
      args.deliverySlotId,
      "delivery",
      args.loadCount,
      now,
    );

    const totals = calculateOrderTotals(args.loadCount, branch.pricePerLoad);
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
      holdExpiresAt: now + 20 * 60 * 1000,
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
      dropoffSlot: slotInfoValidator,
      deliverySlot: slotInfoValidator,
    }),
  ),
  handler: async (ctx) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer", (query) => query.eq("customerId", user._id))
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
            typeof order.holdExpiresAt === "number" &&
            order.paymentStatus !== "paid" &&
            order.holdExpiresAt <= now,
          dropoffSlot: {
            slotId: dropoffSlot._id,
            date: dropoffSlot.date,
            startTime: dropoffSlot.startTime,
            endTime: dropoffSlot.endTime,
          },
          deliverySlot: {
            slotId: deliverySlot._id,
            date: deliverySlot.date,
            startTime: deliverySlot.startTime,
            endTime: deliverySlot.endTime,
          },
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
    specialInstructions: v.optional(v.string()),
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

    const [dropoffSlot, deliverySlot, address, statusHistory] = await Promise.all([
      ctx.db.get(order.dropoffSlotId),
      ctx.db.get(order.deliverySlotId),
      ctx.db.get(order.addressId),
      ctx.db
        .query("orderStatusHistory")
        .withIndex("by_order", (query) => query.eq("orderId", order._id))
        .order("desc")
        .collect(),
    ]);

    if (!dropoffSlot || !deliverySlot || !address) {
      throw new ConvexError("ORDER_DETAIL_INCOMPLETE");
    }

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      currentStatus: order.currentStatus,
      paymentStatus: order.paymentStatus,
      loadCount: order.loadCount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      holdExpired:
        typeof order.holdExpiresAt === "number" &&
        order.paymentStatus !== "paid" &&
        order.holdExpiresAt <= now,
      specialInstructions: order.specialInstructions,
      dropoffSlot: {
        slotId: dropoffSlot._id,
        date: dropoffSlot.date,
        startTime: dropoffSlot.startTime,
        endTime: dropoffSlot.endTime,
      },
      deliverySlot: {
        slotId: deliverySlot._id,
        date: deliverySlot.date,
        startTime: deliverySlot.startTime,
        endTime: deliverySlot.endTime,
      },
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
      statusHistory: statusHistory.map((entry) => ({
        _id: entry._id,
        toStatus: entry.toStatus,
        notes: entry.notes,
        createdAt: entry.createdAt,
      })),
    };
  },
});

async function assertSlotCapacity(
  ctx: MutationCtx,
  slotId: Id<"timeSlots">,
  slotKey: "dropoff" | "delivery",
  requiredLoads: number,
  now: number,
) {
  const slot = await ctx.db.get(slotId);
  if (!slot) {
    throw new ConvexError("SLOT_NOT_FOUND");
  }

  const matchingOrders = await ctx.db
    .query("orders")
    .withIndex(
      slotKey === "dropoff" ? "by_dropoff_slot" : "by_delivery_slot",
      (query) =>
        query.eq(
          slotKey === "dropoff" ? "dropoffSlotId" : "deliverySlotId",
          slot._id,
        ),
    )
    .collect();

  if (
    !hasSufficientCapacity(slot.capacityLoads, matchingOrders, requiredLoads, now)
  ) {
    throw new ConvexError("SLOT_FULL");
  }
}
