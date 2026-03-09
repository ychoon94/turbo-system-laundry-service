import { describe, expect, it } from 'vitest';
import {
    buildCheckoutReturnUrls,
    canResumeCheckout,
    getCheckoutHoldExpiresAt,
    getHoldExpiresAt,
    getStripeTimestamp,
    isCheckoutSessionOpen,
    isDuplicateWebhookEvent,
    toStripeUnitAmount,
} from '../../convex/lib/paymentRules';
import { HOLD_TTL_MS } from '../../convex/lib/domain';

describe('paymentRules', () => {
    it('builds checkout return URLs for success and cancellation states', () => {
        const urls = buildCheckoutReturnUrls('https://example.com/app', 'order_123');

        expect(urls.successUrl).toContain('/customer/orders/order_123');
        expect(urls.successUrl).toContain('checkout=success');
        expect(urls.successUrl).toContain('sessionId={CHECKOUT_SESSION_ID}');
        expect(urls.cancelUrl).toContain('checkout=cancelled');
    });

    it('computes hold expiry and Stripe timestamps from milliseconds', () => {
        expect(getHoldExpiresAt(1_000)).toBe(1_000 + HOLD_TTL_MS);
        expect(getCheckoutHoldExpiresAt(10_000, 10_000 + 5 * 60 * 1000)).toBe(10_000 + HOLD_TTL_MS + 60 * 1000);
        expect(getCheckoutHoldExpiresAt(10_000, 10_000 + 45 * 60 * 1000)).toBe(10_000 + 45 * 60 * 1000);
        expect(getStripeTimestamp(90_001)).toBe(91);
        expect(toStripeUnitAmount(18.5)).toBe(1850);
    });

    it('treats repeated webhook ids as duplicates', () => {
        expect(isDuplicateWebhookEvent('evt_1', 'evt_1')).toBe(true);
        expect(isDuplicateWebhookEvent('evt_1', 'evt_2')).toBe(false);
        expect(isDuplicateWebhookEvent(undefined, 'evt_2')).toBe(false);
    });

    it('allows checkout only while the timed hold is still active', () => {
        const now = 5_000;

        expect(
            canResumeCheckout(
                {
                    currentStatus: 'awaiting_payment',
                    paymentStatus: 'pending',
                    holdExpiresAt: now + 1_000,
                },
                now
            )
        ).toBe(true);

        expect(
            canResumeCheckout(
                {
                    currentStatus: 'cancelled',
                    paymentStatus: 'failed',
                    holdExpiresAt: now + 1_000,
                },
                now
            )
        ).toBe(false);

        expect(
            canResumeCheckout(
                {
                    currentStatus: 'awaiting_payment',
                    paymentStatus: 'pending',
                    holdExpiresAt: now - 1,
                },
                now
            )
        ).toBe(false);
    });

    it('treats checkout as open only when pending await-payment session is active', () => {
        const now = 7_000;

        expect(
            isCheckoutSessionOpen(
                {
                    currentStatus: 'awaiting_payment',
                    paymentStatus: 'pending',
                    paymentSessionId: 'cs_test_123',
                    holdExpiresAt: now + 500,
                },
                now
            )
        ).toBe(true);

        expect(
            isCheckoutSessionOpen(
                {
                    currentStatus: 'awaiting_payment',
                    paymentStatus: 'pending',
                    holdExpiresAt: now + 500,
                },
                now
            )
        ).toBe(false);

        expect(
            isCheckoutSessionOpen(
                {
                    currentStatus: 'cancelled',
                    paymentStatus: 'failed',
                    paymentSessionId: 'cs_test_123',
                    holdExpiresAt: now + 500,
                },
                now
            )
        ).toBe(false);
    });
});
