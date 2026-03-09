import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, httpAction, internalMutation, internalQuery, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { getCurrentUserOrThrow, getUserByClerkId } from './lib/auth';
import { appendOrderHistory } from './lib/orderHistory';
import { isDuplicateWebhookEvent } from './lib/paymentRules';
import { isHoldActive } from './lib/orderRules';
import { releaseOrderSlots } from './lib/slotReservations';

const HOLD_EXPIRY_GRACE_MS = 10 * 60 * 1000;

const checkoutSessionValidator = v.object({
    orderId: v.id('orders'),
    sessionId: v.string(),
    checkoutUrl: v.string(),
    amount: v.number(),
    currency: v.string(),
    holdExpiresAt: v.optional(v.number()),
});

const paymentListItemValidator = v.object({
    _id: v.id('payments'),
    orderId: v.id('orders'),
    orderNumber: v.string(),
    orderStatus: v.string(),
    paymentStatus: v.string(),
    amount: v.number(),
    currency: v.string(),
    providerCheckoutSessionId: v.optional(v.string()),
    providerPaymentIntentId: v.optional(v.string()),
    providerChargeId: v.optional(v.string()),
    providerRefundId: v.optional(v.string()),
    failureCount: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureCode: v.optional(v.string()),
    lastFailureReason: v.optional(v.string()),
    refundReason: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
});

type OrderDoc = Doc<'orders'>;
type PaymentDoc = Doc<'payments'>;
type CheckoutSessionResponse = {
    orderId: Id<'orders'>;
    sessionId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    holdExpiresAt?: number;
};

export const createCheckoutSession = action({
    args: {
        orderId: v.id('orders'),
        origin: v.optional(v.string()),
    },
    returns: checkoutSessionValidator,
    handler: async (ctx, args): Promise<CheckoutSessionResponse> => {
        return await ctx.runAction(internal.paymentsNode.createStripeCheckoutSession, {
            ...args,
        });
    },
});

export const handleStripeWebhook = httpAction(async (ctx, request) => {
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        return new Response('Missing stripe-signature', { status: 400 });
    }

    const body = await request.text();

    try {
        await ctx.runAction(internal.paymentsNode.processStripeWebhook, {
            body,
            signature,
        });

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Stripe webhook processing failed', error);
        return new Response('Webhook processing failed', { status: 400 });
    }
});

export const getMyPayments = query({
    args: {},
    returns: v.array(paymentListItemValidator),
    handler: async (ctx) => {
        const { user } = await getCurrentUserOrThrow(ctx);
        const payments = await ctx.db
            .query('payments')
            .withIndex('by_customer', (db) => db.eq('customerId', user._id))
            .order('desc')
            .collect();

        return await Promise.all(
            payments.map(async (payment) => {
                const order = await ctx.db.get(payment.orderId);

                if (!order) {
                    throw new ConvexError('ORDER_NOT_FOUND');
                }

                return {
                    _id: payment._id,
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    orderStatus: order.currentStatus,
                    paymentStatus: payment.status,
                    amount: payment.amount,
                    currency: payment.currency,
                    providerCheckoutSessionId: payment.providerCheckoutSessionId,
                    providerPaymentIntentId: payment.providerPaymentIntentId,
                    providerChargeId: payment.providerChargeId,
                    providerRefundId: payment.providerRefundId,
                    failureCount: payment.failureCount,
                    lastFailureAt: payment.lastFailureAt,
                    lastFailureCode: payment.lastFailureCode,
                    lastFailureReason: payment.lastFailureReason,
                    refundReason: payment.refundReason,
                    createdAt: payment.createdAt,
                    paidAt: payment.paidAt,
                    refundedAt: payment.refundedAt,
                };
            })
        );
    },
});

export const getCheckoutContext = internalQuery({
    args: {
        clerkUserId: v.string(),
        orderId: v.id('orders'),
    },
    returns: v.object({
        orderId: v.id('orders'),
        customerId: v.id('users'),
        orderNumber: v.string(),
        loadCount: v.number(),
        unitPriceSnapshot: v.number(),
        totalAmount: v.number(),
        currency: v.string(),
        email: v.optional(v.string()),
        paymentStatus: v.string(),
        currentStatus: v.string(),
        holdExpiresAt: v.optional(v.number()),
        paymentSessionId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        const user = await getUserByClerkId(ctx, args.clerkUserId);
        const order = await ctx.db.get(args.orderId);

        if (!user || !order) {
            throw new ConvexError('NOT_FOUND');
        }

        if (order.customerId !== user._id) {
            throw new ConvexError('FORBIDDEN');
        }

        return {
            orderId: order._id,
            customerId: order.customerId,
            orderNumber: order.orderNumber,
            loadCount: order.loadCount,
            unitPriceSnapshot: order.unitPriceSnapshot,
            totalAmount: order.totalAmount,
            currency: order.currency,
            email: user.email,
            paymentStatus: order.paymentStatus,
            currentStatus: order.currentStatus,
            holdExpiresAt: order.holdExpiresAt,
            paymentSessionId: order.paymentSessionId,
        };
    },
});

export const getCheckoutSessionSettlementContext = internalQuery({
    args: {
        sessionId: v.string(),
    },
    returns: v.union(
        v.null(),
        v.object({
            orderId: v.id('orders'),
            paymentId: v.id('payments'),
            orderStatus: v.string(),
            orderPaymentStatus: v.string(),
            paymentStatus: v.string(),
            paymentIntentId: v.optional(v.string()),
            chargeId: v.optional(v.string()),
            refundId: v.optional(v.string()),
            webhookEventId: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        const payment = await ctx.db
            .query('payments')
            .withIndex('by_checkout_session', (db) => db.eq('providerCheckoutSessionId', args.sessionId))
            .unique();

        if (!payment) {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order) {
            return null;
        }

        return {
            orderId: order._id,
            paymentId: payment._id,
            orderStatus: order.currentStatus,
            orderPaymentStatus: order.paymentStatus,
            paymentStatus: payment.status,
            paymentIntentId: payment.providerPaymentIntentId,
            chargeId: payment.providerChargeId,
            refundId: payment.providerRefundId,
            webhookEventId: payment.webhookEventId,
        };
    },
});

export const getPaymentIntentFailureContext = internalQuery({
    args: {
        paymentIntentId: v.string(),
        orderId: v.optional(v.id('orders')),
    },
    returns: v.union(
        v.null(),
        v.object({
            orderId: v.id('orders'),
            paymentId: v.id('payments'),
            checkoutSessionId: v.optional(v.string()),
            orderStatus: v.string(),
            orderPaymentStatus: v.string(),
            paymentStatus: v.string(),
            webhookEventId: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        let payment = await ctx.db
            .query('payments')
            .withIndex('by_payment_intent', (db) => db.eq('providerPaymentIntentId', args.paymentIntentId))
            .unique();

        const fallbackOrderId = args.orderId;
        if (!payment && fallbackOrderId) {
            payment = await ctx.db
                .query('payments')
                .withIndex('by_order', (db) => db.eq('orderId', fallbackOrderId))
                .unique();
        }

        if (!payment) {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order) {
            return null;
        }

        return {
            orderId: order._id,
            paymentId: payment._id,
            checkoutSessionId: payment.providerCheckoutSessionId,
            orderStatus: order.currentStatus,
            orderPaymentStatus: order.paymentStatus,
            paymentStatus: payment.status,
            webhookEventId: payment.webhookEventId,
        };
    },
});

export const refreshCheckoutHold = internalMutation({
    args: {
        orderId: v.id('orders'),
        holdExpiresAt: v.number(),
    },
    returns: v.number(),
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.orderId);

        if (!order) {
            throw new ConvexError('NOT_FOUND');
        }

        if (order.currentStatus === 'cancelled' || order.paymentStatus === 'paid') {
            throw new ConvexError('ORDER_NOT_ELIGIBLE');
        }

        await ctx.db.patch(order._id, {
            holdExpiresAt: args.holdExpiresAt,
            updatedAt: Date.now(),
        });

        return args.holdExpiresAt;
    },
});

export const recordCheckoutSession = internalMutation({
    args: {
        orderId: v.id('orders'),
        sessionId: v.string(),
        paymentIntentId: v.optional(v.string()),
    },
    returns: checkoutSessionValidator,
    handler: async (ctx, args): Promise<CheckoutSessionResponse> => {
        const now = Date.now();
        const order = await ctx.db.get(args.orderId);

        if (!order) {
            throw new ConvexError('NOT_FOUND');
        }

        const payment = await ctx.db
            .query('payments')
            .withIndex('by_order', (db) => db.eq('orderId', order._id))
            .unique();

        if (payment) {
            await ctx.db.patch(payment._id, {
                providerCheckoutSessionId: args.sessionId,
                providerPaymentIntentId: args.paymentIntentId ?? payment.providerPaymentIntentId,
                status: 'pending',
                updatedAt: now,
            });
        } else {
            await ctx.db.insert('payments', {
                orderId: order._id,
                customerId: order.customerId,
                provider: 'stripe',
                providerCheckoutSessionId: args.sessionId,
                providerPaymentIntentId: args.paymentIntentId,
                status: 'pending',
                amount: order.totalAmount,
                currency: order.currency,
                createdAt: now,
                updatedAt: now,
            });
        }

        if (order.currentStatus === 'draft') {
            await ctx.db.patch(order._id, {
                currentStatus: 'awaiting_payment',
                paymentSessionId: args.sessionId,
                updatedAt: now,
            });

            await appendOrderHistory(ctx, {
                orderId: order._id,
                fromStatus: 'draft',
                toStatus: 'awaiting_payment',
                changeSource: 'customer',
                notes: 'Stripe checkout session opened.',
                createdAt: now,
            });
        } else {
            await ctx.db.patch(order._id, {
                paymentSessionId: args.sessionId,
                updatedAt: now,
            });
        }

        return {
            orderId: order._id,
            sessionId: args.sessionId,
            checkoutUrl: '',
            amount: order.totalAmount,
            currency: order.currency,
            holdExpiresAt: order.holdExpiresAt,
        };
    },
});

export const markCheckoutSessionCompleted = internalMutation({
    args: {
        eventId: v.string(),
        sessionId: v.string(),
        paymentIntentId: v.optional(v.string()),
        chargeId: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const payment = await ctx.db
            .query('payments')
            .withIndex('by_checkout_session', (db) => db.eq('providerCheckoutSessionId', args.sessionId))
            .unique();

        if (!payment) {
            return null;
        }

        if (isDuplicateWebhookEvent(payment.webhookEventId, args.eventId)) {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order) {
            return null;
        }

        if (
            order.paymentStatus === 'paid' ||
            order.paymentStatus === 'refunded' ||
            order.currentStatus === 'cancelled'
        ) {
            return null;
        }

        const now = Date.now();
        await ctx.db.patch(payment._id, {
            status: 'paid',
            providerPaymentIntentId: args.paymentIntentId ?? payment.providerPaymentIntentId,
            providerChargeId: args.chargeId ?? payment.providerChargeId,
            webhookEventId: args.eventId,
            webhookEventType: 'checkout.session.completed',
            paidAt: now,
            updatedAt: now,
        });

        await appendOrderHistory(ctx, {
            orderId: order._id,
            fromStatus: order.currentStatus,
            toStatus: 'paid',
            changeSource: 'webhook',
            notes: 'Stripe checkout completed.',
            createdAt: now,
        });

        await appendOrderHistory(ctx, {
            orderId: order._id,
            fromStatus: 'paid',
            toStatus: 'awaiting_dropoff',
            changeSource: 'system',
            notes: 'Payment confirmed by Stripe webhook.',
            createdAt: now,
        });

        await ctx.db.patch(order._id, {
            currentStatus: 'awaiting_dropoff',
            paymentStatus: 'paid',
            paidAt: now,
            holdExpiresAt: undefined,
            updatedAt: now,
        });

        return null;
    },
});

export const markCancelledCheckoutSessionRefunded = internalMutation({
    args: {
        eventId: v.string(),
        sessionId: v.string(),
        paymentIntentId: v.optional(v.string()),
        chargeId: v.optional(v.string()),
        refundId: v.string(),
        refundReason: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const payment = await ctx.db
            .query('payments')
            .withIndex('by_checkout_session', (db) => db.eq('providerCheckoutSessionId', args.sessionId))
            .unique();

        if (!payment) {
            return null;
        }

        if (isDuplicateWebhookEvent(payment.webhookEventId, args.eventId) && payment.status === 'refunded') {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order || order.currentStatus !== 'cancelled') {
            return null;
        }

        const now = Date.now();

        await ctx.db.patch(payment._id, {
            status: 'refunded',
            providerPaymentIntentId: args.paymentIntentId ?? payment.providerPaymentIntentId,
            providerChargeId: args.chargeId ?? payment.providerChargeId,
            providerRefundId: args.refundId,
            refundReason: args.refundReason,
            webhookEventId: args.eventId,
            webhookEventType: 'checkout.session.completed',
            paidAt: payment.paidAt ?? now,
            refundedAt: now,
            updatedAt: now,
        });

        await appendOrderHistory(ctx, {
            orderId: order._id,
            fromStatus: 'cancelled',
            toStatus: 'cancelled',
            changeSource: 'webhook',
            notes: args.refundReason,
            createdAt: now,
        });

        await ctx.db.patch(order._id, {
            paymentStatus: 'refunded',
            holdExpiresAt: undefined,
            updatedAt: now,
        });

        return null;
    },
});

export const markCheckoutSessionExpired = internalMutation({
    args: {
        eventId: v.string(),
        sessionId: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const payment = await ctx.db
            .query('payments')
            .withIndex('by_checkout_session', (db) => db.eq('providerCheckoutSessionId', args.sessionId))
            .unique();

        if (!payment) {
            return null;
        }

        if (isDuplicateWebhookEvent(payment.webhookEventId, args.eventId)) {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order) {
            return null;
        }

        await cancelPendingOrder(ctx, {
            order,
            payment,
            reason: 'Stripe checkout session expired before payment completed.',
            webhookEventId: args.eventId,
            webhookEventType: 'checkout.session.expired',
        });

        return null;
    },
});

export const recordPaymentIntentFailure = internalMutation({
    args: {
        eventId: v.string(),
        paymentIntentId: v.string(),
        orderId: v.optional(v.id('orders')),
        failureCode: v.optional(v.string()),
        failureMessage: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        let payment = await ctx.db
            .query('payments')
            .withIndex('by_payment_intent', (db) => db.eq('providerPaymentIntentId', args.paymentIntentId))
            .unique();

        const fallbackOrderId = args.orderId;
        if (!payment && fallbackOrderId) {
            payment = await ctx.db
                .query('payments')
                .withIndex('by_order', (db) => db.eq('orderId', fallbackOrderId))
                .unique();
        }

        if (!payment) {
            return null;
        }

        if (isDuplicateWebhookEvent(payment.webhookEventId, args.eventId)) {
            return null;
        }

        const order = await ctx.db.get(payment.orderId);
        if (!order) {
            return null;
        }

        if (
            order.currentStatus === 'cancelled' ||
            order.paymentStatus === 'paid' ||
            order.paymentStatus === 'refunded'
        ) {
            return null;
        }

        const now = Date.now();
        await cancelPendingOrder(ctx, {
            order,
            payment,
            reason:
                args.failureMessage ??
                'Stripe declined the first payment attempt. The order was cancelled and the held capacity was released.',
            webhookEventId: args.eventId,
            webhookEventType: 'payment_intent.payment_failed',
            paymentPatch: {
                providerPaymentIntentId: args.paymentIntentId,
                failureCount: (payment.failureCount ?? 0) + 1,
                lastFailureAt: now,
                lastFailureCode: args.failureCode,
                lastFailureReason:
                    args.failureMessage ??
                    'Stripe declined the first payment attempt. The order was cancelled and the held capacity was released.',
            },
        });

        return null;
    },
});

export const releaseExpiredHold = internalMutation({
    args: {
        orderId: v.id('orders'),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.orderId);

        if (!order) {
            return null;
        }

        const now = Date.now();
        if (
            order.paymentStatus === 'paid' ||
            order.paymentStatus === 'refunded' ||
            isHoldActive(order.holdExpiresAt, now)
        ) {
            return null;
        }

        if (order.paymentSessionId && order.currentStatus === 'awaiting_payment') {
            return null;
        }

        const payment = await ctx.db
            .query('payments')
            .withIndex('by_order', (db) => db.eq('orderId', order._id))
            .unique();

        await cancelPendingOrder(ctx, {
            order,
            payment,
            reason: 'Timed hold expired before checkout started.',
        });

        return null;
    },
});

export const cleanupExpiredHolds = internalMutation({
    args: {
        limit: v.optional(v.number()),
    },
    returns: v.number(),
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        const cutoff = Date.now() - HOLD_EXPIRY_GRACE_MS;
        const orders = await ctx.db
            .query('orders')
            .withIndex('by_payment_status_hold_expires_at', (db) => db.eq('paymentStatus', 'pending').lte('holdExpiresAt', cutoff))
            .take(limit);

        let released = 0;

        for (const order of orders) {
            const payment = await ctx.db
                .query('payments')
                .withIndex('by_order', (db) => db.eq('orderId', order._id))
                .unique();

            const didCancel = await cancelPendingOrder(ctx, {
                order,
                payment,
                reason: 'Scheduled cleanup released an expired unpaid hold.',
            });

            if (didCancel) {
                released += 1;
            }
        }

        return released;
    },
});

async function cancelPendingOrder(
    ctx: MutationCtx,
    args: {
        order: OrderDoc;
        payment: PaymentDoc | null;
        reason: string;
        webhookEventId?: string;
        webhookEventType?: string;
        paymentPatch?: Partial<PaymentDoc>;
    }
) {
    if (args.order.paymentStatus === 'paid' || args.order.paymentStatus === 'refunded') {
        return false;
    }

    const now = Date.now();

    if (args.payment) {
        await ctx.db.patch(args.payment._id, {
            ...args.paymentPatch,
            status: 'failed',
            webhookEventId: args.webhookEventId ?? args.payment.webhookEventId,
            webhookEventType: args.webhookEventType ?? args.payment.webhookEventType,
            updatedAt: now,
        });
    }

    if (args.order.currentStatus === 'cancelled') {
        if (args.order.holdExpiresAt !== undefined) {
            await ctx.db.patch(args.order._id, {
                holdExpiresAt: undefined,
                updatedAt: now,
            });
        }

        return false;
    }

    await releaseOrderSlots(ctx, {
        dropoffSlotId: args.order.dropoffSlotId,
        deliverySlotId: args.order.deliverySlotId,
        loadCount: args.order.loadCount,
        updatedAt: now,
    });

    await appendOrderHistory(ctx, {
        orderId: args.order._id,
        fromStatus: args.order.currentStatus,
        toStatus: 'cancelled',
        changeSource: args.webhookEventId ? 'webhook' : 'system',
        notes: args.reason,
        createdAt: now,
    });

    await ctx.db.patch(args.order._id, {
        currentStatus: 'cancelled',
        paymentStatus: 'failed',
        holdExpiresAt: undefined,
        updatedAt: now,
    });

    return true;
}
