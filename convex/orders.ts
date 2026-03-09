import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./lib/auth";
import { HOLD_TTL_MS, buildOrderNumber } from "./lib/domain";
import { appendOrderHistory } from "./lib/orderHistory";
import { isHoldActive } from "./lib/orderRules";
import { calculateOrderTotals } from "./lib/orderRules";
import { getRemainingLoads } from "./lib/orderRules";
import { reserveOrderSlots } from "./lib/slotReservations";

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

    await ctx.scheduler.runAfter(
      HOLD_TTL_MS,
      internal.payments.releaseExpiredHold,
      { orderId },
    );

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

    const [dropoffSlot, deliverySlot, address, statusHistory] = await Promise.all([
      ctx.db.get(order.dropoffSlotId),
      ctx.db.get(order.deliverySlotId),
      ctx.db.get(order.addressId),
      ctx.db
        .query("orderStatusHistory")
        .withIndex("by_order", (db) => db.eq("orderId", order._id))
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
        !isHoldActive(order.holdExpiresAt, now) &&
        !isTerminalPaymentStatus(order.paymentStatus),
      holdExpiresAt: order.holdExpiresAt,
      specialInstructions: order.specialInstructions,
      paymentSessionId: order.paymentSessionId,
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
