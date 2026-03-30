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
}));

import {
  assignOrderToDriver,
  completeDelivery,
  listMyQueue,
  reportDeliveryIssue,
  startDelivery,
} from "../../convex/drivers";

type Handler<Args extends Record<string, unknown>, Result> = {
  _handler: (ctx: unknown, args: Args) => Promise<Result>;
};

function createCtx(args: {
  docsById?: Record<string, Record<string, unknown>>;
  queryResults?: Record<string, Array<Record<string, unknown>>>;
}) {
  const docsById = args.docsById ?? {};
  const queryResults = args.queryResults ?? {};
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];

  const ctx = {
    db: {
      get: async (id: string) => docsById[id] ?? null,
      insert: async (table: string, value: Record<string, unknown>) => {
        inserts.push({ table, value });
        const id = `${table}_inserted_${inserts.length}`;
        docsById[id] = {
          _id: id,
          ...value,
        };
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        docsById[id] = {
          ...(docsById[id] ?? {}),
          ...value,
        };
        patches.push({ id, value });
      },
      query: (tableName: string) => ({
        withIndex: (
          indexName: string,
          predicate: (builder: {
            eq: (field: string, value: unknown) => unknown;
          }) => unknown,
        ) => {
          let lookupValue: unknown;
          const builder = {
            eq: (_field: string, value: unknown) => {
              lookupValue = value;
              return builder;
            },
          };

          predicate(builder);

          return {
            order: () => ({
              collect: async () =>
                queryResults[`${tableName}:${indexName}:${String(lookupValue)}`] ?? [],
            }),
            collect: async () =>
              queryResults[`${tableName}:${indexName}:${String(lookupValue)}`] ?? [],
            unique: async () =>
              queryResults[`${tableName}:${indexName}:${String(lookupValue)}`]?.[0] ?? null,
          };
        },
      }),
    },
    storage: {
      getUrl: vi.fn(async (storageId: string) => `https://files.example.com/${storageId}`),
      generateUploadUrl: vi.fn().mockResolvedValue("https://upload.example.com"),
    },
  };

  return { ctx, docsById, inserts, patches };
}

describe("drivers", () => {
  beforeEach(() => {
    appendOrderHistoryMock.mockReset();
    getCurrentUserWithRoleOrThrowMock.mockReset();
  });

  it("assigns a ready-for-delivery order to an active driver and creates a task", async () => {
    const order = {
      _id: "order_1",
      orderNumber: "TT-20260311-111111",
      currentStatus: "ready_for_delivery",
      paymentStatus: "paid",
      addressId: "address_1",
      deliverySlotId: "slot_delivery_1",
    };
    const address = {
      _id: "address_1",
      label: "Home",
      contactName: "Jamie Customer",
      contactPhone: "+6511111111",
      addressLine1: "1 River Valley Road",
      buildingName: "River Court",
      lobbyOrSecurityNote: "Leave at concierge",
    };
    const driver = {
      _id: "driver_1",
      role: "driver",
      status: "active",
      fullName: "Dylan Driver",
    };
    const { ctx, docsById, inserts } = createCtx({
      docsById: {
        [order._id]: order,
        [address._id]: address,
        [driver._id]: driver,
      },
      queryResults: {
        "deliveryTasks:by_order:order_1": [],
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "admin_1", role: "admin" },
    });

    await (
      assignOrderToDriver as unknown as Handler<
        { orderId: string; driverId: string },
        null
      >
    )._handler(ctx, {
      orderId: order._id,
      driverId: driver._id,
    });

    expect(inserts).toContainEqual({
      table: "deliveryTasks",
      value: expect.objectContaining({
        orderId: order._id,
        status: "unassigned",
      }),
    });
    expect(docsById.deliveryTasks_inserted_1).toEqual(
      expect.objectContaining({
        driverId: driver._id,
        status: "assigned",
      }),
    );
  });

  it("starts and completes delivery with proof", async () => {
    const order = {
      _id: "order_2",
      currentStatus: "ready_for_delivery",
      paymentStatus: "paid",
    };
    const task = {
      _id: "task_2",
      orderId: "order_2",
      driverId: "driver_2",
      status: "assigned",
      proofFileIds: [],
    };
    const { ctx, docsById } = createCtx({
      docsById: {
        [order._id]: order,
        [task._id]: task,
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "driver_2", role: "driver" },
    });

    await (
      startDelivery as unknown as Handler<{ taskId: string }, null>
    )._handler(ctx, {
      taskId: task._id,
    });

    await (
      completeDelivery as unknown as Handler<
        { taskId: string; proofFileIds: string[]; completionNote?: string },
        null
      >
    )._handler(ctx, {
      taskId: task._id,
      proofFileIds: ["storage_1"],
      completionNote: "Delivered to concierge desk.",
    });

    expect(docsById.order_2).toEqual(
      expect.objectContaining({
        currentStatus: "delivered",
      }),
    );
    expect(docsById.task_2).toEqual(
      expect.objectContaining({
        status: "delivered",
        proofFileIds: ["storage_1"],
        completionNote: "Delivered to concierge desk.",
      }),
    );
  });

  it("reports a delivery issue and returns the order to ready_for_delivery", async () => {
    const order = {
      _id: "order_3",
      currentStatus: "out_for_delivery",
      paymentStatus: "paid",
    };
    const task = {
      _id: "task_3",
      orderId: "order_3",
      driverId: "driver_3",
      status: "out_for_delivery",
      proofFileIds: [],
      issueEvidenceFileIds: [],
    };
    const { ctx, docsById } = createCtx({
      docsById: {
        [order._id]: order,
        [task._id]: task,
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "driver_3", role: "driver" },
    });

    await (
      reportDeliveryIssue as unknown as Handler<
        { taskId: string; issueNote: string; evidenceFileIds: string[] },
        null
      >
    )._handler(ctx, {
      taskId: task._id,
      issueNote: "Security desk refused the handoff without resident confirmation.",
      evidenceFileIds: ["storage_issue_1"],
    });

    expect(docsById.order_3).toEqual(
      expect.objectContaining({
        currentStatus: "ready_for_delivery",
      }),
    );
    expect(docsById.task_3).toEqual(
      expect.objectContaining({
        driverId: undefined,
        status: "issue_reported",
        issueNote: "Security desk refused the handoff without resident confirmation.",
        issueEvidenceFileIds: ["storage_issue_1"],
      }),
    );
  });

  it("lists only the current driver's active assigned tasks", async () => {
    const { ctx } = createCtx({
      docsById: {
        task_4: {
          _id: "task_4",
          orderId: "order_4",
          driverId: "driver_4",
          status: "assigned",
          deliverySlotId: "slot_4",
          addressSnapshot: {
            label: "Home",
            contactName: "Jamie Customer",
            contactPhone: "+6511111111",
            addressLine1: "1 River Valley Road",
            buildingName: "River Court",
            lobbyOrSecurityNote: "Leave at concierge",
          },
          proofFileIds: [],
        },
        order_4: {
          _id: "order_4",
          orderNumber: "TT-20260311-444444",
          currentStatus: "ready_for_delivery",
          loadCount: 2,
          customerId: "customer_4",
        },
        customer_4: {
          _id: "customer_4",
          fullName: "Jamie Customer",
          phone: "+6511111111",
        },
        slot_4: {
          _id: "slot_4",
          date: "2026-03-12",
          startTime: "18:00",
          endTime: "20:00",
        },
      },
      queryResults: {
        "deliveryTasks:by_driver:driver_4": [
          {
            _id: "task_4",
            orderId: "order_4",
            driverId: "driver_4",
            status: "assigned",
            deliverySlotId: "slot_4",
            addressSnapshot: {
              label: "Home",
              contactName: "Jamie Customer",
              contactPhone: "+6511111111",
              addressLine1: "1 River Valley Road",
              buildingName: "River Court",
              lobbyOrSecurityNote: "Leave at concierge",
            },
            proofFileIds: [],
          },
        ],
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "driver_4", role: "driver" },
    });

    const result = await (
      listMyQueue as unknown as Handler<Record<string, never>, Array<Record<string, unknown>>>
    )._handler(ctx, {});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        orderNumber: "TT-20260311-444444",
        taskStatus: "assigned",
      }),
    );
  });
});
