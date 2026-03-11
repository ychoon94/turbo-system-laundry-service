import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserWithRoleOrThrowMock } = vi.hoisted(() => ({
  getCurrentUserWithRoleOrThrowMock: vi.fn(),
}));

vi.mock("../../convex/lib/auth", () => ({
  getCurrentUserWithRoleOrThrow: (...args: unknown[]) =>
    getCurrentUserWithRoleOrThrowMock(...args),
}));

import { createIssueReport, generateEvidenceUploadUrl } from "../../convex/issues";
import { listMyQueue } from "../../convex/workers";
import { ConvexError } from "convex/values";

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

  const ctx = {
    db: {
      get: async (id: string) => docsById[id] ?? null,
      insert: async (table: string, value: Record<string, unknown>) => {
        inserts.push({ table, value });
        return `${table}_inserted_1`;
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
              collect: async () => queryResults[`${tableName}:${indexName}:${String(lookupValue)}`] ?? [],
            }),
            collect: async () => queryResults[`${tableName}:${indexName}:${String(lookupValue)}`] ?? [],
          };
        },
      }),
    },
    storage: {
      generateUploadUrl: vi.fn().mockResolvedValue("https://upload.example.com"),
    },
  };

  return { ctx, inserts };
}

describe("issues and worker queue", () => {
  beforeEach(() => {
    getCurrentUserWithRoleOrThrowMock.mockReset();
  });

  it("generates a storage upload URL for authorized ops users", async () => {
    const { ctx } = createCtx({});
    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "worker_1", role: "worker" },
    });

    const result = await (
      generateEvidenceUploadUrl as unknown as Handler<Record<string, never>, string>
    )._handler(ctx, {});

    expect(result).toBe("https://upload.example.com");
  });

  it("records issue evidence ids on a new issue report", async () => {
    const { ctx, inserts } = createCtx({
      docsById: {
        order_1: {
          _id: "order_1",
          currentStatus: "washing",
          paymentStatus: "paid",
          assignedWorkerId: "worker_1",
        },
      },
    });
    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "worker_1", role: "worker" },
    });

    const result = await (
      createIssueReport as unknown as Handler<
        {
          orderId: string;
          issueType: string;
          description: string;
          evidenceFileIds: string[];
        },
        { issueReportId: string }
      >
    )._handler(ctx, {
      orderId: "order_1",
      issueType: "garment_damage",
      description: "Customer garment snagged during wash.",
      evidenceFileIds: ["storage_1", "storage_2"],
    });

    expect(result.issueReportId).toBe("issueReports_inserted_1");
    expect(inserts).toContainEqual({
      table: "issueReports",
      value: expect.objectContaining({
        orderId: "order_1",
        reporterId: "worker_1",
        evidenceFileIds: ["storage_1", "storage_2"],
      }),
    });
  });

  it("rejects issue creation when the order cannot enter issue hold", async () => {
    const { ctx, inserts } = createCtx({
      docsById: {
        order_1: {
          _id: "order_1",
          currentStatus: "issue_hold",
          paymentStatus: "paid",
          assignedWorkerId: "worker_1",
        },
      },
    });
    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "worker_1", role: "worker" },
    });

    await expect(
      (
        createIssueReport as unknown as Handler<
          {
            orderId: string;
            issueType: string;
            description: string;
            evidenceFileIds: string[];
          },
          { issueReportId: string }
        >
      )._handler(ctx, {
        orderId: "order_1",
        issueType: "garment_damage",
        description: "Another issue while the order is already paused.",
        evidenceFileIds: [],
      }),
    ).rejects.toEqual(new ConvexError("INVALID_STATE_TRANSITION"));

    expect(inserts).toHaveLength(0);
  });

  it("returns only the current worker's assigned operational queue", async () => {
    const { ctx } = createCtx({
      docsById: {
        order_1: {
          _id: "order_1",
          orderNumber: "TT-20260309-111111",
          currentStatus: "received_at_shop",
          paymentStatus: "paid",
          loadCount: 2,
          specialInstructions: "Use fragrance-free detergent.",
          customerId: "customer_1",
          dropoffSlotId: "slot_1",
        },
        customer_1: {
          _id: "customer_1",
          fullName: "Test Customer",
          phone: "+6512345678",
        },
        slot_1: {
          _id: "slot_1",
          date: "2026-03-10",
          startTime: "09:00",
          endTime: "11:00",
        },
      },
      queryResults: {
        "orders:by_assigned_worker:worker_1": [
          {
            _id: "order_1",
            orderNumber: "TT-20260309-111111",
            currentStatus: "received_at_shop",
            paymentStatus: "paid",
            loadCount: 2,
            specialInstructions: "Use fragrance-free detergent.",
            customerId: "customer_1",
            dropoffSlotId: "slot_1",
          },
        ],
        "issueReports:by_order:order_1": [],
      },
    });

    getCurrentUserWithRoleOrThrowMock.mockResolvedValue({
      user: { _id: "worker_1", role: "worker" },
    });

    const result = await (
      listMyQueue as unknown as Handler<Record<string, never>, Array<Record<string, unknown>>>
    )._handler(ctx, {});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        orderNumber: "TT-20260309-111111",
        currentStatus: "received_at_shop",
        issueCountOpen: 0,
      }),
    );
  });
});
