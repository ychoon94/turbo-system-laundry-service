import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./lib/auth";
import { appendOrderHistory } from "./lib/orderHistory";

export const createCheckoutSession = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({
    orderId: v.id("orders"),
    sessionId: v.string(),
    amount: v.number(),
    currency: v.string(),
    holdExpiresAt: v.optional(v.number()),
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

    if (
      typeof order.holdExpiresAt === "number" &&
      order.holdExpiresAt <= now &&
      order.paymentStatus !== "paid"
    ) {
      throw new ConvexError("HOLD_EXPIRED");
    }

    if (order.paymentStatus === "paid" && order.paymentSessionId) {
      return {
        orderId: order._id,
        sessionId: order.paymentSessionId,
        amount: order.totalAmount,
        currency: order.currency,
        holdExpiresAt: order.holdExpiresAt,
      };
    }

    const sessionId = order.paymentSessionId ?? `mock_${crypto.randomUUID()}`;
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_order", (query) => query.eq("orderId", order._id))
      .unique();

    if (!payment) {
      await ctx.db.insert("payments", {
        orderId: order._id,
        customerId: user._id,
        provider: "mock_stripe",
        providerCheckoutSessionId: sessionId,
        status: "pending",
        amount: order.totalAmount,
        currency: order.currency,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (order.currentStatus === "draft") {
      await ctx.db.patch(order._id, {
        currentStatus: "awaiting_payment",
        paymentSessionId: sessionId,
        updatedAt: now,
      });

      await appendOrderHistory(ctx, {
        orderId: order._id,
        fromStatus: "draft",
        toStatus: "awaiting_payment",
        changeSource: "customer",
        notes: "Mock checkout session opened.",
        createdAt: now,
      });
    } else {
      await ctx.db.patch(order._id, {
        paymentSessionId: sessionId,
        updatedAt: now,
      });
    }

    return {
      orderId: order._id,
      sessionId,
      amount: order.totalAmount,
      currency: order.currency,
      holdExpiresAt: order.holdExpiresAt,
    };
  },
});

export const completeMockCheckout = mutation({
  args: {
    orderId: v.id("orders"),
    sessionId: v.string(),
  },
  returns: v.object({
    orderId: v.id("orders"),
    paymentStatus: v.string(),
    currentStatus: v.string(),
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

    if (order.paymentStatus === "paid") {
      return {
        orderId: order._id,
        paymentStatus: order.paymentStatus,
        currentStatus: order.currentStatus,
      };
    }

    if (
      typeof order.holdExpiresAt === "number" &&
      order.holdExpiresAt <= now
    ) {
      throw new ConvexError("HOLD_EXPIRED");
    }

    if (order.paymentSessionId !== args.sessionId) {
      throw new ConvexError("SESSION_MISMATCH");
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_order", (query) => query.eq("orderId", order._id))
      .unique();

    if (!payment) {
      throw new ConvexError("PAYMENT_RECORD_MISSING");
    }

    await ctx.db.patch(payment._id, {
      status: "paid",
      paidAt: now,
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: order.currentStatus,
      toStatus: "paid",
      changeSource: "customer",
      notes: "Mock payment confirmed by backend mutation.",
      createdAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: "paid",
      toStatus: "awaiting_dropoff",
      changeSource: "system",
      notes: "Payment complete. Waiting for customer drop-off.",
      createdAt: now,
    });

    await ctx.db.patch(order._id, {
      currentStatus: "awaiting_dropoff",
      paymentStatus: "paid",
      paidAt: now,
      holdExpiresAt: undefined,
      updatedAt: now,
    });

    return {
      orderId: order._id,
      paymentStatus: "paid",
      currentStatus: "awaiting_dropoff",
    };
  },
});
