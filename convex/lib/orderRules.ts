export type ReservationOrder = {
  currentStatus: string;
  paymentStatus: string;
  holdExpiresAt?: number;
  loadCount: number;
};

export function calculateOrderTotals(loadCount: number, pricePerLoad: number) {
  const subtotalAmount = Number((loadCount * pricePerLoad).toFixed(2));

  return {
    subtotalAmount,
    totalAmount: subtotalAmount,
  };
}

export function isDraftHoldActive(order: ReservationOrder, now: number) {
  return (
    order.paymentStatus === "pending" &&
    (order.currentStatus === "draft" ||
      order.currentStatus === "awaiting_payment") &&
    typeof order.holdExpiresAt === "number" &&
    order.holdExpiresAt > now
  );
}

export function contributesToCapacity(order: ReservationOrder, now: number) {
  return order.paymentStatus === "paid" || isDraftHoldActive(order, now);
}

export function getReservedLoads(
  orders: ReservationOrder[],
  now: number,
) {
  return orders.reduce((sum, order) => {
    if (!contributesToCapacity(order, now)) {
      return sum;
    }

    return sum + order.loadCount;
  }, 0);
}

export function getRemainingLoads(
  capacityLoads: number,
  orders: ReservationOrder[],
  now: number,
) {
  return Math.max(capacityLoads - getReservedLoads(orders, now), 0);
}

export function hasSufficientCapacity(
  capacityLoads: number,
  orders: ReservationOrder[],
  requiredLoads: number,
  now: number,
) {
  return getRemainingLoads(capacityLoads, orders, now) >= requiredLoads;
}
