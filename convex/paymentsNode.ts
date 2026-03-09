'use node';

import Stripe from 'stripe';
import { ConvexError, v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
    buildCheckoutReturnUrls,
    canResumeCheckout,
    getCheckoutHoldExpiresAt,
    getStripeTimestamp,
    toStripeUnitAmount,
} from './lib/paymentRules';

const checkoutSessionValidator = v.object({
    orderId: v.id('orders'),
    sessionId: v.string(),
    checkoutUrl: v.string(),
    amount: v.number(),
    currency: v.string(),
    holdExpiresAt: v.optional(v.number()),
});

type CheckoutSessionResponse = {
    orderId: Id<'orders'>;
    sessionId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    holdExpiresAt?: number;
};

function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new ConvexError('STRIPE_NOT_CONFIGURED');
    }

    return new Stripe(secretKey);
}

function resolveOrigin(origin: string | undefined) {
    const fallbackOrigin = process.env.SITE_URL ?? process.env.VITE_CONVEX_SITE_URL;
    const resolvedOrigin = origin ?? fallbackOrigin;

    if (!resolvedOrigin) {
        throw new ConvexError('SITE_URL_NOT_CONFIGURED');
    }

    return new URL(resolvedOrigin).origin;
}

async function expireCheckoutSessionIfOpen(stripe: Stripe, sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status === 'open') {
        await stripe.checkout.sessions.expire(sessionId);
    }
}

export const createStripeCheckoutSession = internalAction({
    args: {
        orderId: v.id('orders'),
        origin: v.optional(v.string()),
    },
    returns: checkoutSessionValidator,
    handler: async (ctx, args): Promise<CheckoutSessionResponse> => {
        const identity = await ctx.auth.getUserIdentity();

        if (!identity) {
            throw new ConvexError('UNAUTHENTICATED');
        }

        const now = Date.now();
        const stripe = getStripe();
        const checkoutContext: {
            orderId: Id<'orders'>;
            customerId: Id<'users'>;
            orderNumber: string;
            loadCount: number;
            unitPriceSnapshot: number;
            totalAmount: number;
            currency: string;
            email?: string;
            paymentStatus: string;
            currentStatus: string;
            holdExpiresAt?: number;
            paymentSessionId?: string;
        } = await ctx.runQuery(internal.payments.getCheckoutContext, {
            clerkUserId: identity.subject,
            orderId: args.orderId,
        });

        if (!canResumeCheckout(checkoutContext, now)) {
            throw new ConvexError('HOLD_EXPIRED');
        }

        const origin = resolveOrigin(args.origin);
        const { successUrl, cancelUrl } = buildCheckoutReturnUrls(origin, checkoutContext.orderId);

        if (checkoutContext.paymentSessionId) {
            const existingSession = await stripe.checkout.sessions.retrieve(checkoutContext.paymentSessionId);

            if (existingSession.status === 'open' && existingSession.url) {
                return {
                    orderId: checkoutContext.orderId,
                    sessionId: existingSession.id,
                    checkoutUrl: existingSession.url,
                    amount: checkoutContext.totalAmount,
                    currency: checkoutContext.currency,
                    holdExpiresAt: checkoutContext.holdExpiresAt,
                };
            }
        }

        const holdExpiresAt = getCheckoutHoldExpiresAt(now, checkoutContext.holdExpiresAt);

        await ctx.runMutation(internal.payments.refreshCheckoutHold, {
            orderId: checkoutContext.orderId,
            holdExpiresAt,
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: checkoutContext.orderId,
            customer_email: checkoutContext.email,
            payment_method_types: ['card'],
            expires_at: getStripeTimestamp(holdExpiresAt),
            payment_intent_data: {
                metadata: {
                    orderId: checkoutContext.orderId,
                    customerId: checkoutContext.customerId,
                    orderNumber: checkoutContext.orderNumber,
                },
            },
            line_items: [
                {
                    quantity: checkoutContext.loadCount,
                    price_data: {
                        currency: checkoutContext.currency.toLowerCase(),
                        unit_amount: toStripeUnitAmount(checkoutContext.unitPriceSnapshot),
                        product_data: {
                            name: 'Laundry service',
                            description: `${checkoutContext.loadCount} load${checkoutContext.loadCount === 1 ? '' : 's'} for ${checkoutContext.orderNumber}`,
                        },
                    },
                },
            ],
            metadata: {
                orderId: checkoutContext.orderId,
                customerId: checkoutContext.customerId,
                orderNumber: checkoutContext.orderNumber,
            },
        });

        const checkoutUrl = session.url;

        if (!checkoutUrl) {
            throw new ConvexError('CHECKOUT_URL_MISSING');
        }

        const paymentIntent: unknown = session.payment_intent;
        let paymentIntentId: string | undefined;

        if (typeof paymentIntent === 'string') {
            paymentIntentId = String(paymentIntent);
        } else if (paymentIntent && typeof paymentIntent === 'object') {
            const expandedPaymentIntent = paymentIntent as { id?: string };
            paymentIntentId = expandedPaymentIntent.id;
        }

        await ctx.runMutation(internal.payments.recordCheckoutSession, {
            orderId: checkoutContext.orderId,
            sessionId: session.id,
            paymentIntentId,
        });

        return {
            orderId: checkoutContext.orderId,
            sessionId: session.id,
            checkoutUrl: checkoutUrl as string,
            amount: checkoutContext.totalAmount,
            currency: checkoutContext.currency,
            holdExpiresAt,
        };
    },
});

export const processStripeWebhook = internalAction({
    args: {
        body: v.string(),
        signature: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new ConvexError('STRIPE_WEBHOOK_NOT_CONFIGURED');
        }

        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(args.body, args.signature, webhookSecret);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
            let chargeId: string | undefined;

            if (paymentIntentId) {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                    expand: ['latest_charge'],
                });
                const latestCharge = paymentIntent.latest_charge;

                if (typeof latestCharge === 'string') {
                    chargeId = latestCharge;
                } else if (latestCharge?.id) {
                    chargeId = latestCharge.id;
                }
            }

            const settlementContext = await ctx.runQuery(internal.payments.getCheckoutSessionSettlementContext, {
                sessionId: session.id,
            });

            const isCancelledOrder =
                settlementContext?.orderStatus === 'cancelled' ||
                settlementContext?.orderPaymentStatus === 'failed' ||
                settlementContext?.orderPaymentStatus === 'refunded';

            if (settlementContext?.paymentStatus === 'refunded' || settlementContext?.refundId) {
                return null;
            }

            if (settlementContext && isCancelledOrder) {
                if (!paymentIntentId && !chargeId) {
                    throw new ConvexError('REFUND_TARGET_MISSING');
                }

                const refund = await stripe.refunds.create(
                    paymentIntentId
                        ? {
                              payment_intent: paymentIntentId,
                              metadata: {
                                  checkoutSessionId: session.id,
                                  trigger: 'late_success_cancelled_order',
                              },
                          }
                        : {
                              charge: chargeId,
                              metadata: {
                                  checkoutSessionId: session.id,
                                  trigger: 'late_success_cancelled_order',
                              },
                          },
                    {
                        idempotencyKey: `late-success-refund:${session.id}:${event.id}`,
                    }
                );

                await ctx.runMutation(internal.payments.markCancelledCheckoutSessionRefunded, {
                    eventId: event.id,
                    sessionId: session.id,
                    paymentIntentId,
                    chargeId,
                    refundId: refund.id,
                    refundReason: 'Stripe reported a payment after the order was already cancelled, so the charge was refunded automatically.',
                });

                return null;
            }

            await ctx.runMutation(internal.payments.markCheckoutSessionCompleted, {
                eventId: event.id,
                sessionId: session.id,
                paymentIntentId,
                chargeId,
            });

            return null;
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data.object as Stripe.Checkout.Session;

            await ctx.runMutation(internal.payments.markCheckoutSessionExpired, {
                eventId: event.id,
                sessionId: session.id,
            });

            return null;
        }

        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            let orderId =
                typeof paymentIntent.metadata?.orderId === 'string' ? paymentIntent.metadata.orderId : undefined;
            let failureContext = await ctx.runQuery(internal.payments.getPaymentIntentFailureContext, {
                paymentIntentId: paymentIntent.id,
                orderId: orderId as Id<'orders'> | undefined,
            });

            if (!failureContext) {
                const matchingSessions = await stripe.checkout.sessions.list({
                    payment_intent: paymentIntent.id,
                    limit: 1,
                });
                const checkoutSession = matchingSessions.data[0];
                const fallbackOrderId =
                    typeof checkoutSession?.metadata?.orderId === 'string' ? checkoutSession.metadata.orderId : undefined;

                if (fallbackOrderId) {
                    orderId = fallbackOrderId;
                    failureContext = await ctx.runQuery(internal.payments.getPaymentIntentFailureContext, {
                        paymentIntentId: paymentIntent.id,
                        orderId: fallbackOrderId as Id<'orders'>,
                    });
                }
            }

            if (failureContext?.checkoutSessionId) {
                await expireCheckoutSessionIfOpen(stripe, failureContext.checkoutSessionId);
            }

            await ctx.runMutation(internal.payments.recordPaymentIntentFailure, {
                eventId: event.id,
                paymentIntentId: paymentIntent.id,
                orderId: orderId as Id<'orders'> | undefined,
                failureCode: paymentIntent.last_payment_error?.code,
                failureMessage: paymentIntent.last_payment_error?.message,
            });
        }

        return null;
    },
});
