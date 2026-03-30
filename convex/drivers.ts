import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { getCurrentUserWithRoleOrThrow } from "./lib/auth";
import { ensureDeliveryTaskForOrder } from "./lib/deliveryTasks";
import { appendOrderHistory } from "./lib/orderHistory";
import { canAssignDriver } from "./lib/orderOperations";

type DeliveryTaskDoc = Doc<"deliveryTasks">;

const userSummaryValidator = v.object({
  userId: v.id("users"),
  fullName: v.string(),
  email: v.optional(v.string()),
});

const customerSummaryValidator = v.object({
  userId: v.id("users"),
  fullName: v.string(),
  phone: v.optional(v.string()),
});

const slotInfoValidator = v.object({
  slotId: v.id("timeSlots"),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
});

const addressSnapshotValidator = v.object({
  label: v.string(),
  contactName: v.string(),
  contactPhone: v.string(),
  addressLine1: v.string(),
  addressLine2: v.optional(v.string()),
  buildingName: v.string(),
  towerBlock: v.optional(v.string()),
  unitNumber: v.optional(v.string()),
  lobbyOrSecurityNote: v.string(),
});

const deliveryTaskStatusValidator = v.union(
  v.literal("unassigned"),
  v.literal("assigned"),
  v.literal("out_for_delivery"),
  v.literal("issue_reported"),
  v.literal("delivered"),
);

const evidenceFileValidator = v.object({
  storageId: v.id("_storage"),
  url: v.union(v.string(), v.null()),
});

const queueItemValidator = v.object({
  _id: v.id("deliveryTasks"),
  orderId: v.id("orders"),
  orderNumber: v.string(),
  orderStatus: v.string(),
  taskStatus: deliveryTaskStatusValidator,
  loadCount: v.number(),
  customer: customerSummaryValidator,
  deliverySlot: slotInfoValidator,
  issueNote: v.optional(v.string()),
});

const taskDetailValidator = v.object({
  _id: v.id("deliveryTasks"),
  orderId: v.id("orders"),
  orderNumber: v.string(),
  orderStatus: v.string(),
  taskStatus: deliveryTaskStatusValidator,
  loadCount: v.number(),
  currency: v.string(),
  totalAmount: v.number(),
  specialInstructions: v.optional(v.string()),
  customer: customerSummaryValidator,
  assignedDriver: v.union(userSummaryValidator, v.null()),
  deliverySlot: slotInfoValidator,
  addressSnapshot: addressSnapshotValidator,
  proofFiles: v.array(evidenceFileValidator),
  issueNote: v.optional(v.string()),
  issueEvidenceFiles: v.array(evidenceFileValidator),
  completionNote: v.optional(v.string()),
  statusHistory: v.array(
    v.object({
      _id: v.id("orderStatusHistory"),
      toStatus: v.string(),
      changeSource: v.string(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
});

function toUserSummary(user: Pick<Doc<"users">, "_id" | "fullName" | "email"> | null) {
  return user
    ? {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
      }
    : null;
}

function toSlotInfo(slot: {
  _id: Id<"timeSlots">;
  date: string;
  startTime: string;
  endTime: string;
}) {
  return {
    slotId: slot._id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  };
}

async function getRequiredTaskOrderContext(
  ctx: {
    db: {
      get: <TableName extends TableNames>(
        id: Id<TableName>,
      ) => Promise<Doc<TableName> | null>;
    };
  },
  task: DeliveryTaskDoc,
) {
  const order = await ctx.db.get(task.orderId);
  if (!order) {
    throw new ConvexError("NOT_FOUND");
  }

  const [customer, deliverySlot, assignedDriver] = await Promise.all([
    ctx.db.get(order.customerId),
    ctx.db.get(task.deliverySlotId),
    task.driverId ? ctx.db.get(task.driverId) : Promise.resolve(null),
  ]);

  if (!customer || !deliverySlot) {
    throw new ConvexError("ORDER_CONTEXT_MISSING");
  }

  return { order, customer, deliverySlot, assignedDriver };
}

async function buildEvidenceFiles(
  storage: {
    getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
  },
  storageIds: Id<"_storage">[],
) {
  return await Promise.all(
    storageIds.map(async (storageId) => ({
      storageId,
      url: await storage.getUrl(storageId),
    })),
  );
}

async function buildTaskDetail(
  ctx: Parameters<typeof getCurrentUserWithRoleOrThrow>[0],
  task: DeliveryTaskDoc,
) {
  const [{ order, customer, deliverySlot, assignedDriver }, statusHistory, proofFiles, issueEvidenceFiles] =
    await Promise.all([
      getRequiredTaskOrderContext(ctx, task),
      ctx.db
        .query("orderStatusHistory")
        .withIndex("by_order", (query) => query.eq("orderId", task.orderId))
        .order("desc")
        .collect(),
      buildEvidenceFiles(ctx.storage, task.proofFileIds),
      buildEvidenceFiles(ctx.storage, task.issueEvidenceFileIds ?? []),
    ]);

  return {
    _id: task._id,
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.currentStatus,
    taskStatus: task.status,
    loadCount: order.loadCount,
    currency: order.currency,
    totalAmount: order.totalAmount,
    specialInstructions: order.specialInstructions,
    customer: {
      userId: customer._id,
      fullName: customer.fullName,
      phone: customer.phone,
    },
    assignedDriver: toUserSummary(assignedDriver),
    deliverySlot: toSlotInfo(deliverySlot),
    addressSnapshot: task.addressSnapshot,
    proofFiles,
    issueNote: task.issueNote,
    issueEvidenceFiles,
    completionNote: task.completionNote,
    statusHistory: statusHistory.map((entry) => ({
      _id: entry._id,
      toStatus: entry.toStatus,
      changeSource: entry.changeSource,
      notes: entry.notes,
      createdAt: entry.createdAt,
    })),
  };
}

export const listAssignableDrivers = query({
  args: {},
  returns: v.array(userSummaryValidator),
  handler: async (ctx) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const drivers = await ctx.db
      .query("users")
      .withIndex("by_role", (query) => query.eq("role", "driver"))
      .collect();

    return drivers
      .filter((driver) => driver.status === "active")
      .map((driver) => ({
        userId: driver._id,
        fullName: driver.fullName,
        email: driver.email,
      }));
  },
});

export const assignOrderToDriver = mutation({
  args: {
    orderId: v.id("orders"),
    driverId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const [order, driver] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.driverId),
    ]);

    if (!order || !driver) {
      throw new ConvexError("NOT_FOUND");
    }

    if (driver.role !== "driver" || driver.status !== "active") {
      throw new ConvexError("FORBIDDEN");
    }

    if (!canAssignDriver(order)) {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    const now = Date.now();
    const task = await ensureDeliveryTaskForOrder({ db: ctx.db }, order, now);

    await ctx.db.patch(task._id, {
      driverId: driver._id,
      status: "assigned",
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: order.currentStatus,
      toStatus: order.currentStatus,
      changeSource: "admin",
      notes: `Assigned delivery to ${driver.fullName}.`,
      createdAt: now,
    });

    return null;
  },
});

export const generateProofUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["driver", "admin"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listMyQueue = query({
  args: {},
  returns: v.array(queueItemValidator),
  handler: async (ctx) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["driver"]);
    const tasks = await ctx.db
      .query("deliveryTasks")
      .withIndex("by_driver", (query) => query.eq("driverId", user._id))
      .order("desc")
      .collect();

    const visibleTasks = tasks.filter(
      (task) => task.status === "assigned" || task.status === "out_for_delivery",
    );

    return await Promise.all(
      visibleTasks.map(async (task) => {
        const { order, customer, deliverySlot } = await getRequiredTaskOrderContext(ctx, task);
        return {
          _id: task._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderStatus: order.currentStatus,
          taskStatus: task.status,
          loadCount: order.loadCount,
          customer: {
            userId: customer._id,
            fullName: customer.fullName,
            phone: customer.phone,
          },
          deliverySlot: toSlotInfo(deliverySlot),
          issueNote: task.issueNote,
        };
      }),
    );
  },
});

export const getMyTaskDetail = query({
  args: {
    taskId: v.id("deliveryTasks"),
  },
  returns: taskDetailValidator,
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["driver"]);
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.driverId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    return await buildTaskDetail(ctx, task);
  },
});

export const startDelivery = mutation({
  args: {
    taskId: v.id("deliveryTasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["driver"]);
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.driverId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    const order = await ctx.db.get(task.orderId);
    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (order.currentStatus !== "ready_for_delivery" || task.status !== "assigned") {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "out_for_delivery",
      startedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(order._id, {
      currentStatus: "out_for_delivery",
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: "ready_for_delivery",
      toStatus: "out_for_delivery",
      changeSource: "driver",
      notes: "Driver started the final-mile delivery run.",
      createdAt: now,
    });

    return null;
  },
});

export const completeDelivery = mutation({
  args: {
    taskId: v.id("deliveryTasks"),
    proofFileIds: v.array(v.id("_storage")),
    completionNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["driver"]);
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.driverId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    const order = await ctx.db.get(task.orderId);
    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.status !== "out_for_delivery" || order.currentStatus !== "out_for_delivery") {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    if (args.proofFileIds.length === 0) {
      throw new ConvexError("DELIVERY_PROOF_REQUIRED");
    }

    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "delivered",
      proofFileIds: args.proofFileIds,
      completionNote: args.completionNote,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(order._id, {
      currentStatus: "delivered",
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: "out_for_delivery",
      toStatus: "delivered",
      changeSource: "driver",
      notes: args.completionNote ?? "Driver completed delivery with proof.",
      createdAt: now,
    });

    return null;
  },
});

export const reportDeliveryIssue = mutation({
  args: {
    taskId: v.id("deliveryTasks"),
    issueNote: v.string(),
    evidenceFileIds: v.array(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["driver"]);
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.driverId !== user._id) {
      throw new ConvexError("FORBIDDEN");
    }

    const order = await ctx.db.get(task.orderId);
    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (task.status !== "out_for_delivery" || order.currentStatus !== "out_for_delivery") {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    const trimmedIssueNote = args.issueNote.trim();
    if (!trimmedIssueNote) {
      throw new ConvexError("DELIVERY_ISSUE_NOTE_REQUIRED");
    }

    const now = Date.now();
    await ctx.db.patch(task._id, {
      driverId: undefined,
      status: "issue_reported",
      issueNote: trimmedIssueNote,
      issueEvidenceFileIds: args.evidenceFileIds,
      issueReportedAt: now,
      proofFileIds: [],
      completionNote: undefined,
      completedAt: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(order._id, {
      currentStatus: "ready_for_delivery",
      updatedAt: now,
    });

    await appendOrderHistory(ctx, {
      orderId: order._id,
      fromStatus: "out_for_delivery",
      toStatus: "ready_for_delivery",
      changeSource: "driver",
      notes: `Delivery issue reported: ${trimmedIssueNote}`,
      createdAt: now,
    });

    return null;
  },
});
