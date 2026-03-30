import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AddressDoc = Doc<"addresses">;
type OrderDoc = Doc<"orders">;
type DeliveryTaskQueryCtx = Pick<QueryCtx, "db">;
type DeliveryTaskMutationCtx = Pick<MutationCtx, "db">;

export type DeliveryAddressSnapshot = {
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  buildingName: string;
  towerBlock?: string;
  unitNumber?: string;
  lobbyOrSecurityNote: string;
};

export function toDeliveryAddressSnapshot(address: AddressDoc): DeliveryAddressSnapshot {
  return {
    label: address.label,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    buildingName: address.buildingName,
    towerBlock: address.towerBlock,
    unitNumber: address.unitNumber,
    lobbyOrSecurityNote: address.lobbyOrSecurityNote,
  };
}

export async function getDeliveryTaskByOrderId(
  ctx: DeliveryTaskQueryCtx | DeliveryTaskMutationCtx,
  orderId: Id<"orders">,
) {
  return await ctx.db
    .query("deliveryTasks")
    .withIndex("by_order", (query) => query.eq("orderId", orderId))
    .unique();
}

export async function ensureDeliveryTaskForOrder(
  ctx: DeliveryTaskMutationCtx,
  order: OrderDoc,
  now: number,
) {
  const existingTask = await getDeliveryTaskByOrderId(ctx, order._id);

  if (existingTask) {
    return existingTask;
  }

  const address = await ctx.db.get(order.addressId);
  if (!address) {
    throw new ConvexError("ORDER_CONTEXT_MISSING");
  }

  const taskId = await ctx.db.insert("deliveryTasks", {
    orderId: order._id,
    driverId: undefined,
    status: "unassigned",
    deliverySlotId: order.deliverySlotId,
    addressSnapshot: toDeliveryAddressSnapshot(address),
    proofFileIds: [],
    issueNote: undefined,
    issueEvidenceFileIds: [],
    completionNote: undefined,
    createdAt: now,
    updatedAt: now,
  });

  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new ConvexError("DELIVERY_TASK_MISSING");
  }

  return task;
}

export async function resetDeliveryTaskForReadyState(
  ctx: DeliveryTaskMutationCtx,
  taskId: Id<"deliveryTasks">,
  now: number,
) {
  await ctx.db.patch(taskId, {
    status: "unassigned",
    driverId: undefined,
    startedAt: undefined,
    completedAt: undefined,
    proofFileIds: [],
    updatedAt: now,
  });
}
