import { describe, expect, it } from "vitest";
import {
  canAssignWorker,
  canEnterIssueHold,
  canResumeFromIssueHold,
  getNextOperationalStatus,
  isWorkerQueueStatus,
} from "../../convex/lib/orderOperations";

describe("orderOperations", () => {
  it("returns the next operational status in the worker flow", () => {
    expect(getNextOperationalStatus("awaiting_dropoff")).toBe("received_at_shop");
    expect(getNextOperationalStatus("received_at_shop")).toBe("washing");
    expect(getNextOperationalStatus("washing")).toBe("drying");
    expect(getNextOperationalStatus("drying")).toBe("folding");
    expect(getNextOperationalStatus("folding")).toBe("ready_for_delivery");
    expect(getNextOperationalStatus("ready_for_delivery")).toBeUndefined();
  });

  it("only treats paid operational orders as assignable worker work", () => {
    expect(
      canAssignWorker({
        currentStatus: "awaiting_dropoff",
        paymentStatus: "paid",
        assignedWorkerId: undefined,
      }),
    ).toBe(true);

    expect(
      canAssignWorker({
        currentStatus: "draft",
        paymentStatus: "pending",
        assignedWorkerId: undefined,
      }),
    ).toBe(false);

    expect(
      canAssignWorker({
        currentStatus: "cancelled",
        paymentStatus: "failed",
        assignedWorkerId: undefined,
      }),
    ).toBe(false);
  });

  it("limits issue hold entry and resume states to the operational subset", () => {
    expect(canEnterIssueHold("received_at_shop")).toBe(true);
    expect(canEnterIssueHold("folding")).toBe(true);
    expect(canEnterIssueHold("awaiting_dropoff")).toBe(false);

    expect(canResumeFromIssueHold("washing")).toBe(true);
    expect(canResumeFromIssueHold("ready_for_delivery")).toBe(true);
    expect(canResumeFromIssueHold("received_at_shop")).toBe(false);
  });

  it("marks the worker queue statuses explicitly", () => {
    expect(isWorkerQueueStatus("issue_hold")).toBe(true);
    expect(isWorkerQueueStatus("ready_for_delivery")).toBe(true);
    expect(isWorkerQueueStatus("draft")).toBe(false);
  });
});
