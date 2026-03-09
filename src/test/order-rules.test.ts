import { describe, expect, it } from "vitest";
import {
  calculateOrderTotals,
  getAdjustedReservedLoads,
  getRemainingLoads,
  isDraftHoldActive,
  isHoldActive,
} from "../../convex/lib/orderRules";

describe("orderRules", () => {
  it("calculates totals from load count and price", () => {
    expect(calculateOrderTotals(3, 18.5)).toEqual({
      subtotalAmount: 55.5,
      totalAmount: 55.5,
    });
  });

  it("computes remaining capacity from explicit reserved loads", () => {
    expect(getRemainingLoads(10, 6)).toBe(4);
    expect(getRemainingLoads(10, 12)).toBe(0);
  });

  it("adjusts reservations without allowing underflow", () => {
    expect(getAdjustedReservedLoads(4, 3)).toBe(7);
    expect(() => getAdjustedReservedLoads(2, -3)).toThrow(
      "RESERVED_LOADS_UNDERFLOW",
    );
  });

  it("recognizes active timed holds for pending draft-style orders", () => {
    expect(isHoldActive(2_000, 1_500)).toBe(true);
    expect(isHoldActive(2_000, 2_000)).toBe(false);

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
          currentStatus: "cancelled",
          paymentStatus: "failed",
          holdExpiresAt: 2_000,
          loadCount: 2,
        },
        1_500,
      ),
    ).toBe(false);
  });
});
