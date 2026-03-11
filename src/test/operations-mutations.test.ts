import { beforeEach, describe, expect, it, vi } from "vitest";

const { appendOrderHistoryMock, getCurrentUserWithRoleOrThrowMock } = vi.hoisted(() => ({
  appendOrderHistoryMock: vi.fn(),
  getCurrentUserWithRoleOrThrowMock: vi.fn(),
}));

vi.mock("../../convex/lib/orderHistory", () => ({
  appendOrderHistory: (...args: unknown[]) => appendOrderHistoryMock(...args),
}));

vi.mock("../../convex/lib/auth", () => ({
  getCurrentUserWithRoleOrThrow: (...args: unknown[]) =>
    getCurrentUserWithRoleOrThrowMock(...args),
  getCurrentUserOrThrow: (...args: unknown[]) => getCurrentUserWithRoleOrThrowMock(...args),
}));

import {
  getAdminOrderDetail,
  markLaundryReceivedAtShop,
  putOnIssueHold,
  resumeFromIssueHold,
  startWashing,
} from "../../convex/orders";
import { assignOrderToWorker } from "../../convex/workers";
import { ConvexError } from "convex/values";

type MockDoc = Record<string, unknown>;
type MutationHandler<Args extends Record<string, unknown>, Result> = {
  _handler: (ctx: unknown, args: Args) => Promise<Result>;
};

function createMockCtx(args: { docsById: Record<string, MockDoc> }) {
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];

  return {
    ctx: {
      db: {
        get: async (id: string) => args.docsById[id] ?? null,
        patch: async (id: string, value: Record<string, unknown>) => {
          const existing = args.docsById[id] ?? {};
          args.docsById[id] = {
            ...existing,
            ...value,
          };
          patches.push({ id, value });
        },
        insert: async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return `${table}_${inserts.length}`;
        },
      },
    },
    patches,
    inserts,
  };
}

describe("operations mutations", () => {
  beforeEach(() => {
    appendOrderHistoryMock.mockReset();
    getCurrentUserWithRoleOrThrowMock.mockReset();
  });

  it("assigns a paid operational order to an active worker", async () => {
    const order = {
      _id: "order_1",
      currentStatus: "awaiting_dropoff",
      paymentStatus: "paid",
    };
    const worker = {
      _id: "worker_1",
      role: "worker",
      status: "active",
      fullName: "Maya Worker",
    };
    const { ctx, patches } = createMockCtx({
      docsById: {
        [order._id]: order,
        [worker._id]: worker,
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "admin_1", role: "admin" },
    });

    const result = await (
      assignOrderToWorker as unknown as MutationHandler<
        { orderId: string; workerId: string },
        null
      >
    )._handler(ctx, {
      orderId: "order_1",
      workerId: "worker_1",
    });

    expect(result).toBeNull();
    expect(patches[0]).toEqual({
      id: "order_1",
      value: expect.objectContaining({ assignedWorkerId: "worker_1" }),
    });
    expect(appendOrderHistoryMock).toHaveBeenCalledWith(ctx, {
      orderId: "order_1",
      fromStatus: "awaiting_dropoff",
      toStatus: "awaiting_dropoff",
      changeSource: "admin",
      notes: "Assigned to Maya Worker.",
      createdAt: expect.any(Number),
    });
  });

  it("lets an assigned worker receive laundry and start washing", async () => {
    const order = {
      _id: "order_2",
      currentStatus: "awaiting_dropoff",
      paymentStatus: "paid",
      assignedWorkerId: "worker_2",
    };
    const { ctx, patches } = createMockCtx({
      docsById: {
        [order._id]: order,
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "worker_2", role: "worker" },
    });

    await (
      markLaundryReceivedAtShop as unknown as MutationHandler<
        { orderId: string },
        { status: string }
      >
    )._handler(ctx, {
      orderId: "order_2",
    });
    await (
      startWashing as unknown as MutationHandler<
        { orderId: string },
        { status: string }
      >
    )._handler(ctx, {
      orderId: "order_2",
    });

    expect(patches[0]?.value.currentStatus).toBe("received_at_shop");
    expect(patches[1]?.value.currentStatus).toBe("washing");
  });

  it("puts an in-process order on issue hold and resolves it back into the flow", async () => {
    const order = {
      _id: "order_3",
      currentStatus: "washing",
      paymentStatus: "paid",
      assignedWorkerId: "worker_3",
      readyForDeliveryAt: undefined,
    };
    const issueReport = {
      _id: "issue_3",
      orderId: "order_3",
      status: "open",
      issueType: "garment_damage",
    };
    const { ctx, patches } = createMockCtx({
      docsById: {
        [order._id]: order,
        [issueReport._id]: issueReport,
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValueOnce({
      user: { _id: "worker_3", role: "worker" },
    });

    await (
      putOnIssueHold as unknown as MutationHandler<
        { orderId: string; issueReportId: string },
        { status: string }
      >
    )._handler(ctx, {
      orderId: "order_3",
      issueReportId: "issue_3",
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValueOnce({
      user: { _id: "admin_3", role: "admin" },
    });

    await (
      resumeFromIssueHold as unknown as MutationHandler<
        { orderId: string; issueReportId: string; nextStatus: "drying"; note: string },
        { status: string }
      >
    )._handler(ctx, {
      orderId: "order_3",
      issueReportId: "issue_3",
      nextStatus: "drying",
      note: "Garment separated and safe to continue.",
    });

    expect(patches[0]?.value.currentStatus).toBe("issue_hold");
    expect(patches[1]?.id).toBe("issue_3");
    expect(patches[1]?.value.status).toBe("resolved");
    expect(patches[2]?.value.currentStatus).toBe("drying");
  });

  it("hides non-operational orders from admin detail access", async () => {
    const { ctx } = createMockCtx({
      docsById: {
        order_4: {
          _id: "order_4",
          currentStatus: "awaiting_payment",
          paymentStatus: "pending",
        },
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "admin_4", role: "admin" },
    });

    await expect(
      (
        getAdminOrderDetail as unknown as MutationHandler<
          { orderId: string },
          Record<string, unknown>
        >
      )._handler(ctx, {
        orderId: "order_4",
      }),
    ).rejects.toEqual(new ConvexError("NOT_FOUND"));
  });
});
