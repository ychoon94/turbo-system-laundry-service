import type { Doc } from "../_generated/dataModel";

type OrderDoc = Pick<
  Doc<"orders">,
  "currentStatus" | "paymentStatus" | "assignedWorkerId"
>;

export const workerQueueStatuses = [
  "awaiting_dropoff",
  "received_at_shop",
  "washing",
  "drying",
  "folding",
  "issue_hold",
] as const;

export const operationalStatuses = [
  ...workerQueueStatuses,
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;

export const operationalProgression = {
  awaiting_dropoff: "received_at_shop",
  received_at_shop: "washing",
  washing: "drying",
  drying: "folding",
  folding: "ready_for_delivery",
} as const;

export const deliveryProgression = {
  ready_for_delivery: "out_for_delivery",
  out_for_delivery: "delivered",
} as const;

export const issueHoldSourceStatuses = [
  "received_at_shop",
  "washing",
  "drying",
  "folding",
] as const;

export const issueHoldResumeStatuses = [
  "washing",
  "drying",
  "folding",
  "ready_for_delivery",
] as const;

export function isOperationallyReady(order: OrderDoc) {
  return order.paymentStatus === "paid" && order.currentStatus !== "cancelled";
}

export function isOperationallyAccessible(order: OrderDoc) {
  return (
    isOperationallyReady(order) &&
    operationalStatuses.includes(
      order.currentStatus as (typeof operationalStatuses)[number],
    )
  );
}

export function isWorkerQueueAccessible(order: OrderDoc) {
  return (
    isOperationallyReady(order) &&
    workerQueueStatuses.includes(
      order.currentStatus as (typeof workerQueueStatuses)[number],
    )
  );
}

export function canAssignWorker(order: OrderDoc) {
  return isWorkerQueueAccessible(order);
}

export function canAssignDriver(order: OrderDoc) {
  return (
    isOperationallyReady(order) &&
    order.currentStatus === "ready_for_delivery"
  );
}

export function isWorkerQueueStatus(status: string) {
  return workerQueueStatuses.includes(status as (typeof workerQueueStatuses)[number]);
}

export function getNextOperationalStatus(currentStatus: string) {
  return operationalProgression[
    currentStatus as keyof typeof operationalProgression
  ];
}

export const getExpectedNextOperationalStatus = getNextOperationalStatus;

export function getNextDeliveryOrderStatus(currentStatus: string) {
  return deliveryProgression[currentStatus as keyof typeof deliveryProgression];
}

export function canEnterIssueHold(currentStatus: string) {
  return issueHoldSourceStatuses.includes(
    currentStatus as (typeof issueHoldSourceStatuses)[number],
  );
}

export const canTransitionToIssueHold = canEnterIssueHold;

export function canResumeFromIssueHold(nextStatus: string) {
  return issueHoldResumeStatuses.includes(
    nextStatus as (typeof issueHoldResumeStatuses)[number],
  );
}

export function isAssignedToWorker(order: OrderDoc, userId: Doc<"users">["_id"]) {
  return order.assignedWorkerId === userId;
}
