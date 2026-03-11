import { v } from "convex/values";

export const HOLD_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_CURRENCY = "SGD";
export const DEFAULT_TIMEZONE = "Asia/Singapore";
export const DEFAULT_PRICE_PER_LOAD = 18.5;

export const userRoleValidator = v.union(
  v.literal("customer"),
  v.literal("worker"),
  v.literal("driver"),
  v.literal("admin"),
);

export const userStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
);

export const slotTypeValidator = v.union(
  v.literal("dropoff"),
  v.literal("delivery"),
);

export const slotStatusValidator = v.union(
  v.literal("open"),
  v.literal("closed"),
  v.literal("full"),
);

export const serviceTypeValidator = v.literal("self_dropoff");

export const orderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("awaiting_payment"),
  v.literal("paid"),
  v.literal("awaiting_dropoff"),
  v.literal("received_at_shop"),
  v.literal("washing"),
  v.literal("drying"),
  v.literal("folding"),
  v.literal("ready_for_delivery"),
  v.literal("issue_hold"),
  v.literal("cancelled"),
);

export const paymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("refunded"),
);

export const paymentProviderValidator = v.union(
  v.literal("stripe"),
  v.literal("mock_stripe"),
);

export const changeSourceValidator = v.union(
  v.literal("customer"),
  v.literal("worker"),
  v.literal("admin"),
  v.literal("system"),
  v.literal("webhook"),
);

export const issueTypeValidator = v.union(
  v.literal("garment_damage"),
  v.literal("machine_issue"),
  v.literal("missing_item"),
  v.literal("access_problem"),
  v.literal("delay"),
  v.literal("other"),
);

export const issueStatusValidator = v.union(
  v.literal("open"),
  v.literal("resolved"),
);

export function buildOrderNumber(now: number) {
  const compactDate = new Date(now).toISOString().slice(0, 10).replaceAll("-", "");
  return `TT-${compactDate}-${String(now).slice(-6)}`;
}
