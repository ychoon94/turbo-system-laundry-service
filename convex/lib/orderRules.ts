export function calculateOrderTotals(loadCount: number, pricePerLoad: number) {
  const subtotalAmount = Number((loadCount * pricePerLoad).toFixed(2));

  return {
    subtotalAmount,
    totalAmount: subtotalAmount,
  };
}

export function isHoldActive(holdExpiresAt: number | undefined, now: number) {
  return typeof holdExpiresAt === "number" && holdExpiresAt > now;
}

export type ReservationOrder = {
  currentStatus: string;
  paymentStatus: string;
  holdExpiresAt?: number;
  loadCount: number;
};

export function isDraftHoldActive(order: ReservationOrder, now: number) {
  return (
    order.paymentStatus === "pending" &&
    (order.currentStatus === "draft" ||
      order.currentStatus === "awaiting_payment") &&
    isHoldActive(order.holdExpiresAt, now)
  );
}

export function getAdjustedReservedLoads(
  currentReservedLoads: number,
  deltaLoads: number,
) {
  const nextReservedLoads = currentReservedLoads + deltaLoads;

  if (nextReservedLoads < 0) {
    throw new Error("RESERVED_LOADS_UNDERFLOW");
  }

  return nextReservedLoads;
}

export function hasSufficientCapacity(
  capacityLoads: number,
  reservedLoads: number,
  requiredLoads: number,
) {
  return getRemainingLoads(capacityLoads, reservedLoads) >= requiredLoads;
}

export function getRemainingLoads(
  capacityLoads: number,
  reservedLoads: number,
) {
  return Math.max(capacityLoads - reservedLoads, 0);
}
