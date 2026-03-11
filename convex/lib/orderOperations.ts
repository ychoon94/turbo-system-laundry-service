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
  "ready_for_delivery",
] as const;

export const operationalProgression = {
  awaiting_dropoff: "received_at_shop",
  received_at_shop: "washing",
  washing: "drying",
  drying: "folding",
  folding: "ready_for_delivery",
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
    workerQueueStatuses.includes(
      order.currentStatus as (typeof workerQueueStatuses)[number],
    )
  );
}

export function canAssignWorker(order: OrderDoc) {
  return isOperationallyAccessible(order);
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
