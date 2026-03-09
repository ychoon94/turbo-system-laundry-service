import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendOrderHistoryMock, releaseOrderSlotsMock } = vi.hoisted(() => ({
    appendOrderHistoryMock: vi.fn(),
    releaseOrderSlotsMock: vi.fn(),
}));

vi.mock('../../convex/lib/orderHistory', () => ({
    appendOrderHistory: (...args: unknown[]) => appendOrderHistoryMock(...args),
}));

vi.mock('../../convex/lib/slotReservations', () => ({
    releaseOrderSlots: (...args: unknown[]) => releaseOrderSlotsMock(...args),
}));

import {
    markCancelledCheckoutSessionRefunded,
    markCheckoutSessionCompleted,
    markCheckoutSessionExpired,
    recordPaymentIntentFailure,
} from '../../convex/payments';

type MockDoc = Record<string, unknown>;
type InternalMutationHandler<Args extends Record<string, unknown>> = {
    _handler: (ctx: unknown, args: Args) => Promise<null>;
};

function createMockCtx(args: { docsById: Record<string, MockDoc>; queryResults: Record<string, MockDoc | null> }) {
    const patches: Array<{ id: string; value: Record<string, unknown> }> = [];

    const ctx = {
        db: {
            query: (tableName: string) => ({
                withIndex: (
                    indexName: string,
                    predicate: (builder: {
                        eq: (field: string, value: unknown) => unknown;
                        lte: (field: string, value: unknown) => unknown;
                    }) => unknown
                ) => {
                    let lookupValue: unknown;
                    const builder = {
                        eq: (_field: string, value: unknown) => {
                            lookupValue = value;
                            return builder;
                        },
                        lte: (_field: string, value: unknown) => {
                            lookupValue = value;
                            return builder;
                        },
                    };

                    predicate(builder);

                    return {
                        unique: async () => {
                            const key = `${tableName}:${indexName}:${String(lookupValue)}`;
                            return args.queryResults[key] ?? null;
                        },
                    };
                },
            }),
            get: async (id: string) => {
                return args.docsById[id] ?? null;
            },
            patch: async (id: string, value: Record<string, unknown>) => {
                const existing = args.docsById[id] ?? {};
                args.docsById[id] = {
                    ...existing,
                    ...value,
                };
                patches.push({ id, value });
            },
        },
    };

    return {
        ctx,
        patches,
    };
}

describe('payment webhook guardrails', () => {
    beforeEach(() => {
        appendOrderHistoryMock.mockReset();
        releaseOrderSlotsMock.mockReset();
    });

    it('cancels the order and releases slot reservations on the first payment_intent failure', async () => {
        const payment = {
            _id: 'payment_1',
            orderId: 'order_1',
            status: 'pending',
            webhookEventId: undefined,
            failureCount: 0,
        };
        const order = {
            _id: 'order_1',
            currentStatus: 'awaiting_payment',
            paymentStatus: 'pending',
            paymentSessionId: 'cs_test_1',
            holdExpiresAt: Date.now() + 5 * 60 * 1000,
            dropoffSlotId: 'slot_dropoff_1',
            deliverySlotId: 'slot_delivery_1',
            loadCount: 2,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_payment_intent:pi_test_1': payment,
            },
        });

        await (
            recordPaymentIntentFailure as unknown as InternalMutationHandler<{
                eventId: string;
                paymentIntentId: string;
                failureCode?: string;
                failureMessage?: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_test_1',
            paymentIntentId: 'pi_test_1',
            failureCode: 'insufficient_funds',
            failureMessage: 'Your card has insufficient funds.',
        });

        const paymentPatch = patches.find((patch) => patch.id === payment._id);
        const orderPatch = patches.find((patch) => patch.id === order._id);

        expect(paymentPatch).toBeDefined();
        expect(paymentPatch?.value.status).toBe('failed');
        expect(paymentPatch?.value.failureCount).toBe(1);
        expect(paymentPatch?.value.lastFailureCode).toBe('insufficient_funds');
        expect(paymentPatch?.value.lastFailureReason).toBe('Your card has insufficient funds.');
        expect(paymentPatch?.value.webhookEventType).toBe('payment_intent.payment_failed');
        expect(orderPatch).toBeDefined();
        expect(orderPatch?.value.currentStatus).toBe('cancelled');
        expect(orderPatch?.value.paymentStatus).toBe('failed');
        expect(releaseOrderSlotsMock).toHaveBeenCalledTimes(1);
        expect(appendOrderHistoryMock).toHaveBeenCalledTimes(1);
        expect(appendOrderHistoryMock).toHaveBeenCalledWith(ctx, {
            orderId: 'order_1',
            fromStatus: 'awaiting_payment',
            toStatus: 'cancelled',
            changeSource: 'webhook',
            notes: 'Your card has insufficient funds.',
            createdAt: expect.any(Number),
        });
    });

    it('keeps failure recording idempotent for duplicate event ids', async () => {
        const payment = {
            _id: 'payment_2',
            orderId: 'order_2',
            status: 'pending',
            webhookEventId: 'evt_duplicate',
            failureCount: 1,
        };
        const order = {
            _id: 'order_2',
            currentStatus: 'awaiting_payment',
            paymentStatus: 'pending',
            paymentSessionId: 'cs_test_2',
            holdExpiresAt: Date.now() + 5 * 60 * 1000,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_payment_intent:pi_test_2': payment,
            },
        });

        await (
            recordPaymentIntentFailure as unknown as InternalMutationHandler<{
                eventId: string;
                paymentIntentId: string;
                failureCode?: string;
                failureMessage?: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_duplicate',
            paymentIntentId: 'pi_test_2',
        });

        expect(patches).toHaveLength(0);
        expect(releaseOrderSlotsMock).not.toHaveBeenCalled();
        expect(appendOrderHistoryMock).not.toHaveBeenCalled();
    });

    it('does not move a cancelled order back into fulfillment on a late checkout success webhook', async () => {
        const payment = {
            _id: 'payment_2b',
            orderId: 'order_2b',
            status: 'failed',
            webhookEventId: 'evt_cancelled_earlier',
            providerPaymentIntentId: 'pi_test_2b',
            providerChargeId: undefined,
        };
        const order = {
            _id: 'order_2b',
            currentStatus: 'cancelled',
            paymentStatus: 'failed',
            holdExpiresAt: undefined,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_checkout_session:cs_test_late_success': payment,
            },
        });

        await (
            markCheckoutSessionCompleted as unknown as InternalMutationHandler<{
                eventId: string;
                sessionId: string;
                paymentIntentId?: string;
                chargeId?: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_late_success',
            sessionId: 'cs_test_late_success',
            paymentIntentId: 'pi_test_2b',
            chargeId: 'ch_test_2b',
        });

        const paymentPatch = patches.find((patch) => patch.id === payment._id);
        const orderPatch = patches.find((patch) => patch.id === order._id);

        expect(paymentPatch).toBeUndefined();
        expect(orderPatch).toBeUndefined();
        expect(releaseOrderSlotsMock).not.toHaveBeenCalled();
        expect(appendOrderHistoryMock).not.toHaveBeenCalled();
    });

    it('ignores a late payment_intent failure after the order is already cancelled', async () => {
        const payment = {
            _id: 'payment_2c',
            orderId: 'order_2c',
            status: 'failed',
            webhookEventId: 'evt_session_expired',
            failureCount: 1,
        };
        const order = {
            _id: 'order_2c',
            currentStatus: 'cancelled',
            paymentStatus: 'failed',
            paymentSessionId: 'cs_test_2c',
            holdExpiresAt: undefined,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_payment_intent:pi_test_2c': payment,
            },
        });

        await (
            recordPaymentIntentFailure as unknown as InternalMutationHandler<{
                eventId: string;
                paymentIntentId: string;
                failureCode?: string;
                failureMessage?: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_late_failed_attempt',
            paymentIntentId: 'pi_test_2c',
            failureCode: 'generic_decline',
        });

        const paymentPatch = patches.find((patch) => patch.id === payment._id);
        const orderPatch = patches.find((patch) => patch.id === order._id);

        expect(paymentPatch).toBeUndefined();
        expect(orderPatch).toBeUndefined();
        expect(releaseOrderSlotsMock).not.toHaveBeenCalled();
        expect(appendOrderHistoryMock).not.toHaveBeenCalled();
    });

    it('marks a cancelled order as refunded after a late checkout success is reversed', async () => {
        const payment = {
            _id: 'payment_2d',
            orderId: 'order_2d',
            status: 'failed',
            webhookEventId: 'evt_payment_failed_earlier',
            providerPaymentIntentId: 'pi_test_2d',
            providerChargeId: 'ch_test_2d',
        };
        const order = {
            _id: 'order_2d',
            currentStatus: 'cancelled',
            paymentStatus: 'failed',
            holdExpiresAt: undefined,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_checkout_session:cs_test_refund': payment,
            },
        });

        await (
            markCancelledCheckoutSessionRefunded as unknown as InternalMutationHandler<{
                eventId: string;
                sessionId: string;
                paymentIntentId?: string;
                chargeId?: string;
                refundId: string;
                refundReason: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_late_success_refunded',
            sessionId: 'cs_test_refund',
            paymentIntentId: 'pi_test_2d',
            chargeId: 'ch_test_2d',
            refundId: 're_test_2d',
            refundReason: 'Automatic refund after late success on a cancelled order.',
        });

        const paymentPatch = patches.find((patch) => patch.id === payment._id);
        const orderPatch = patches.find((patch) => patch.id === order._id);

        expect(paymentPatch).toBeDefined();
        expect(paymentPatch?.value.status).toBe('refunded');
        expect(paymentPatch?.value.providerRefundId).toBe('re_test_2d');
        expect(paymentPatch?.value.refundReason).toBe(
            'Automatic refund after late success on a cancelled order.'
        );
        expect(orderPatch).toBeDefined();
        expect(orderPatch?.value.paymentStatus).toBe('refunded');
        expect(appendOrderHistoryMock).toHaveBeenCalledTimes(1);
        expect(appendOrderHistoryMock).toHaveBeenCalledWith(ctx, {
            orderId: 'order_2d',
            fromStatus: 'cancelled',
            toStatus: 'cancelled',
            changeSource: 'webhook',
            notes: 'Automatic refund after late success on a cancelled order.',
            createdAt: expect.any(Number),
        });
    });

    it('terminally cancels and releases slot reservations on checkout.session.expired', async () => {
        const payment = {
            _id: 'payment_3',
            orderId: 'order_3',
            status: 'pending',
            webhookEventId: undefined,
            webhookEventType: undefined,
        };
        const order = {
            _id: 'order_3',
            currentStatus: 'awaiting_payment',
            paymentStatus: 'pending',
            holdExpiresAt: Date.now() + 5 * 60 * 1000,
            dropoffSlotId: 'slot_dropoff_3',
            deliverySlotId: 'slot_delivery_3',
            loadCount: 3,
        };

        const { ctx, patches } = createMockCtx({
            docsById: {
                [order._id]: order,
                [payment._id]: payment,
            },
            queryResults: {
                'payments:by_checkout_session:cs_test_3': payment,
            },
        });

        await (
            markCheckoutSessionExpired as unknown as InternalMutationHandler<{
                eventId: string;
                sessionId: string;
            }>
        )._handler(ctx, {
            eventId: 'evt_expired_1',
            sessionId: 'cs_test_3',
        });

        const paymentPatch = patches.find((patch) => patch.id === payment._id);
        const orderPatch = patches.find((patch) => patch.id === order._id);

        expect(paymentPatch).toBeDefined();
        expect(paymentPatch?.value.status).toBe('failed');
        expect(paymentPatch?.value.webhookEventType).toBe('checkout.session.expired');
        expect(orderPatch).toBeDefined();
        expect(orderPatch?.value.currentStatus).toBe('cancelled');
        expect(orderPatch?.value.paymentStatus).toBe('failed');
        expect(orderPatch?.value.holdExpiresAt).toBeUndefined();
        expect(releaseOrderSlotsMock).toHaveBeenCalledTimes(1);
        expect(releaseOrderSlotsMock).toHaveBeenCalledWith(ctx, {
            dropoffSlotId: 'slot_dropoff_3',
            deliverySlotId: 'slot_delivery_3',
            loadCount: 3,
            updatedAt: expect.any(Number),
        });
        expect(appendOrderHistoryMock).toHaveBeenCalledTimes(1);
        expect(appendOrderHistoryMock).toHaveBeenCalledWith(ctx, {
            orderId: 'order_3',
            fromStatus: 'awaiting_payment',
            toStatus: 'cancelled',
            changeSource: 'webhook',
            notes: 'Stripe checkout session expired before payment completed.',
            createdAt: expect.any(Number),
        });
    });
});
