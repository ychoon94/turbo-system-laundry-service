import { HOLD_TTL_MS } from './domain';
import { isHoldActive } from './orderRules';

export type CheckoutReturnState = 'success' | 'cancelled';
const STRIPE_CHECKOUT_EXPIRY_BUFFER_MS = 60 * 1000;

export function buildCheckoutReturnUrls(origin: string, orderId: string) {
    const baseUrl = new URL(origin);
    const orderPath = `/customer/orders/${orderId}`;
    const successUrl = new URL(orderPath, baseUrl);
    const cancelUrl = new URL(orderPath, baseUrl);

    successUrl.searchParams.set('checkout', 'success');
    successUrl.searchParams.set('sessionId', '{CHECKOUT_SESSION_ID}');
    cancelUrl.searchParams.set('checkout', 'cancelled');
    cancelUrl.searchParams.set('sessionId', '{CHECKOUT_SESSION_ID}');

    return {
        successUrl: decodeCheckoutSessionPlaceholder(successUrl.toString()),
        cancelUrl: decodeCheckoutSessionPlaceholder(cancelUrl.toString()),
    };
}

function decodeCheckoutSessionPlaceholder(value: string) {
    return value.replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
}

export function getHoldExpiresAt(now: number) {
    return now + HOLD_TTL_MS;
}

export function getCheckoutHoldExpiresAt(now: number, currentHoldExpiresAt: number | undefined) {
    return Math.max(currentHoldExpiresAt ?? 0, getHoldExpiresAt(now) + STRIPE_CHECKOUT_EXPIRY_BUFFER_MS);
}

export function getStripeTimestamp(valueMs: number) {
    return Math.ceil(valueMs / 1000);
}

export function toStripeUnitAmount(amount: number) {
    return Math.round(amount * 100);
}

export function isDuplicateWebhookEvent(previousEventId: string | undefined, nextEventId: string) {
    return previousEventId === nextEventId;
}

export function canResumeCheckout(
    args: {
        currentStatus: string;
        paymentStatus: string;
        holdExpiresAt?: number;
    },
    now: number
) {
    return args.currentStatus !== 'cancelled' && args.paymentStatus === 'pending' && isHoldActive(args.holdExpiresAt, now);
}

export function isCheckoutSessionOpen(
    args: {
        currentStatus: string;
        paymentStatus: string;
        paymentSessionId?: string;
        holdExpiresAt?: number;
    },
    now: number
) {
    return (
        args.currentStatus === 'awaiting_payment' &&
        args.paymentStatus === 'pending' &&
        typeof args.paymentSessionId === 'string' &&
        isHoldActive(args.holdExpiresAt, now)
    );
}
