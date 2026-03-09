import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructEventMock,
  retrieveSessionMock,
  expireSessionMock,
  listSessionsMock,
  paymentIntentRetrieveMock,
  refundsCreateMock,
  runQueryMock,
  runMutationMock,
  getCheckoutSessionSettlementContextRef,
  getPaymentIntentFailureContextRef,
  markCancelledCheckoutSessionRefundedRef,
  markCheckoutSessionCompletedRef,
  recordPaymentIntentFailureRef,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  retrieveSessionMock: vi.fn(),
  expireSessionMock: vi.fn(),
  listSessionsMock: vi.fn(),
  paymentIntentRetrieveMock: vi.fn(),
  refundsCreateMock: vi.fn(),
  runQueryMock: vi.fn(),
  runMutationMock: vi.fn(),
  getCheckoutSessionSettlementContextRef: Symbol("getCheckoutSessionSettlementContext"),
  getPaymentIntentFailureContextRef: Symbol("getPaymentIntentFailureContext"),
  markCancelledCheckoutSessionRefundedRef: Symbol("markCancelledCheckoutSessionRefunded"),
  markCheckoutSessionCompletedRef: Symbol("markCheckoutSessionCompleted"),
  recordPaymentIntentFailureRef: Symbol("recordPaymentIntentFailure"),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = {
      constructEvent: (...args: unknown[]) => constructEventMock(...args),
    };

    checkout = {
      sessions: {
        retrieve: (...args: unknown[]) => retrieveSessionMock(...args),
        expire: (...args: unknown[]) => expireSessionMock(...args),
        list: (...args: unknown[]) => listSessionsMock(...args),
      },
    };

    paymentIntents = {
      retrieve: (...args: unknown[]) => paymentIntentRetrieveMock(...args),
    };

    refunds = {
      create: (...args: unknown[]) => refundsCreateMock(...args),
    };
  },
}));

vi.mock("../../convex/_generated/api", () => ({
  internal: {
    payments: {
      getCheckoutSessionSettlementContext: getCheckoutSessionSettlementContextRef,
      getPaymentIntentFailureContext: getPaymentIntentFailureContextRef,
      markCancelledCheckoutSessionRefunded: markCancelledCheckoutSessionRefundedRef,
      markCheckoutSessionCompleted: markCheckoutSessionCompletedRef,
      recordPaymentIntentFailure: recordPaymentIntentFailureRef,
    },
  },
}));

import { processStripeWebhook } from "../../convex/paymentsNode";

type InternalActionHandler<Args extends Record<string, unknown>> = {
  _handler: (ctx: unknown, args: Args) => Promise<null>;
};

describe("processStripeWebhook", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    constructEventMock.mockReset();
    retrieveSessionMock.mockReset();
    expireSessionMock.mockReset();
    listSessionsMock.mockReset();
    paymentIntentRetrieveMock.mockReset();
    refundsCreateMock.mockReset();
    runQueryMock.mockReset();
    runMutationMock.mockReset();
  });

  it("finds the checkout session by payment intent, expires it, and then records first payment failure", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_failed_1",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_1",
          metadata: {},
          last_payment_error: {
            code: "insufficient_funds",
            message: "Your card has insufficient funds.",
          },
        },
      },
    });
    runQueryMock.mockImplementation(async (ref: symbol, args?: { orderId?: string }) => {
      if (ref === getPaymentIntentFailureContextRef) {
        if (!args?.orderId) {
          return null;
        }

        return {
          checkoutSessionId: "cs_test_1",
        };
      }

      return null;
    });
    listSessionsMock.mockResolvedValue({
      data: [
        {
          id: "cs_test_1",
          metadata: {
            orderId: "order_test_1",
          },
        },
      ],
    });
    retrieveSessionMock.mockResolvedValue({ status: "open" });
    expireSessionMock.mockResolvedValue({ id: "cs_test_1" });
    runMutationMock.mockResolvedValue(null);

    await (
      processStripeWebhook as unknown as InternalActionHandler<{
        body: string;
        signature: string;
      }>
    )._handler(
      {
        runQuery: runQueryMock,
        runMutation: runMutationMock,
      },
      {
        body: "body",
        signature: "signature",
      },
    );

    expect(listSessionsMock).toHaveBeenCalledWith({
      payment_intent: "pi_test_1",
      limit: 1,
    });
    expect(retrieveSessionMock).toHaveBeenCalledWith("cs_test_1");
    expect(expireSessionMock).toHaveBeenCalledWith("cs_test_1");
    expect(runMutationMock).toHaveBeenCalledWith(recordPaymentIntentFailureRef, {
      eventId: "evt_failed_1",
      paymentIntentId: "pi_test_1",
      orderId: "order_test_1",
      failureCode: "insufficient_funds",
      failureMessage: "Your card has insufficient funds.",
    });
    expect(expireSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      runMutationMock.mock.invocationCallOrder[0],
    );
  });

  it("refunds a late checkout success for a cancelled order instead of reopening fulfillment", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_completed_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_completed_1",
          payment_intent: "pi_test_completed_1",
        },
      },
    });
    paymentIntentRetrieveMock.mockResolvedValue({
      latest_charge: "ch_test_completed_1",
    });
    runQueryMock.mockImplementation(async (ref: symbol) => {
      if (ref === getCheckoutSessionSettlementContextRef) {
        return {
          orderStatus: "cancelled",
          orderPaymentStatus: "failed",
          paymentStatus: "failed",
        };
      }

      return null;
    });
    refundsCreateMock.mockResolvedValue({ id: "re_test_completed_1" });
    runMutationMock.mockResolvedValue(null);

    await (
      processStripeWebhook as unknown as InternalActionHandler<{
        body: string;
        signature: string;
      }>
    )._handler(
      {
        runQuery: runQueryMock,
        runMutation: runMutationMock,
      },
      {
        body: "body",
        signature: "signature",
      },
    );

    expect(refundsCreateMock).toHaveBeenCalledWith(
      {
        payment_intent: "pi_test_completed_1",
        metadata: {
          checkoutSessionId: "cs_test_completed_1",
          trigger: "late_success_cancelled_order",
        },
      },
      {
        idempotencyKey: "late-success-refund:cs_test_completed_1:evt_completed_1",
      },
    );
    expect(runMutationMock).toHaveBeenCalledWith(markCancelledCheckoutSessionRefundedRef, {
      eventId: "evt_completed_1",
      sessionId: "cs_test_completed_1",
      paymentIntentId: "pi_test_completed_1",
      chargeId: "ch_test_completed_1",
      refundId: "re_test_completed_1",
      refundReason:
        "Stripe reported a payment after the order was already cancelled, so the charge was refunded automatically.",
    });
    expect(runMutationMock).not.toHaveBeenCalledWith(
      markCheckoutSessionCompletedRef,
      expect.anything(),
    );
  });

  it("throws when the automatic refund fails so Stripe can retry the webhook", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_completed_2",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_completed_2",
          payment_intent: "pi_test_completed_2",
        },
      },
    });
    paymentIntentRetrieveMock.mockResolvedValue({
      latest_charge: "ch_test_completed_2",
    });
    runQueryMock.mockImplementation(async (ref: symbol) => {
      if (ref === getCheckoutSessionSettlementContextRef) {
        return {
          orderStatus: "cancelled",
          orderPaymentStatus: "failed",
          paymentStatus: "failed",
        };
      }

      return null;
    });
    refundsCreateMock.mockRejectedValue(new Error("refund failed"));

    await expect(
      (
        processStripeWebhook as unknown as InternalActionHandler<{
          body: string;
          signature: string;
        }>
      )._handler(
        {
          runQuery: runQueryMock,
          runMutation: runMutationMock,
        },
        {
          body: "body",
          signature: "signature",
        },
      ),
    ).rejects.toThrow("refund failed");

    expect(runMutationMock).not.toHaveBeenCalled();
  });
});
