import { describe, expect, it } from "vitest";
import {
  calculateOrderTotals,
  getRemainingLoads,
  isDraftHoldActive,
} from "../../convex/lib/orderRules";

describe("orderRules", () => {
  it("calculates totals from load count and price", () => {
    expect(calculateOrderTotals(3, 18.5)).toEqual({
      subtotalAmount: 55.5,
      totalAmount: 55.5,
    });
  });

  it("counts active holds and paid orders toward capacity", () => {
    const now = 1_000;
    const remainingLoads = getRemainingLoads(
      10,
      [
        {
          currentStatus: "draft",
          paymentStatus: "pending",
          holdExpiresAt: now + 100,
          loadCount: 2,
        },
        {
          currentStatus: "awaiting_dropoff",
          paymentStatus: "paid",
          loadCount: 4,
        },
        {
          currentStatus: "awaiting_payment",
          paymentStatus: "pending",
          holdExpiresAt: now - 100,
          loadCount: 3,
        },
      ],
      now,
    );

    expect(remainingLoads).toBe(4);
  });

  it("expires pending holds once the TTL passes", () => {
    expect(
      isDraftHoldActive(
        {
          currentStatus: "awaiting_payment",
          paymentStatus: "pending",
          holdExpiresAt: 2_000,
          loadCount: 2,
        },
        1_500,
      ),
    ).toBe(true);

    expect(
      isDraftHoldActive(
        {
          currentStatus: "awaiting_payment",
          paymentStatus: "pending",
          holdExpiresAt: 2_000,
          loadCount: 2,
        },
        2_000,
      ),
    ).toBe(false);
  });
});
