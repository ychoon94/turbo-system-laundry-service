import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  getAdjustedReservedLoads,
  getRemainingLoads,
  hasSufficientCapacity,
} from "./orderRules";

type SlotType = Doc<"timeSlots">["slotType"];
type SlotStatus = Doc<"timeSlots">["status"];

function deriveSlotStatus(
  currentStatus: SlotStatus,
  capacityLoads: number,
  reservedLoads: number,
) {
  if (currentStatus === "closed") {
    return currentStatus;
  }

  return reservedLoads >= capacityLoads ? "full" : "open";
}

async function getSlotOrThrow(
  ctx: MutationCtx,
  slotId: Id<"timeSlots">,
) {
  const slot = await ctx.db.get(slotId);

  if (!slot) {
    throw new ConvexError("SLOT_NOT_FOUND");
  }

  return slot;
}

export async function assertSlotCanReserve(
  ctx: MutationCtx,
  args: {
    slotId: Id<"timeSlots">;
    branchId: Id<"branches">;
    slotType: SlotType;
    requiredLoads: number;
  },
) {
  const slot = await getSlotOrThrow(ctx, args.slotId);

  if (slot.branchId !== args.branchId || slot.slotType !== args.slotType) {
    throw new ConvexError("INVALID_SLOT_SELECTION");
  }

  if (slot.status === "closed") {
    throw new ConvexError("SLOT_CLOSED");
  }

  if (
    !hasSufficientCapacity(
      slot.capacityLoads,
      slot.reservedLoads ?? 0,
      args.requiredLoads,
    )
  ) {
    throw new ConvexError("SLOT_FULL");
  }

  return slot;
}

export async function adjustSlotReservation(
  ctx: MutationCtx,
  args: {
    slotId: Id<"timeSlots">;
    deltaLoads: number;
    updatedAt: number;
  },
) {
  const slot = await getSlotOrThrow(ctx, args.slotId);
  const reservedLoads = getAdjustedReservedLoads(
    slot.reservedLoads ?? 0,
    args.deltaLoads,
  );

  if (reservedLoads > slot.capacityLoads) {
    throw new ConvexError("SLOT_FULL");
  }

  await ctx.db.patch(slot._id, {
    reservedLoads,
    status: deriveSlotStatus(slot.status, slot.capacityLoads, reservedLoads),
    updatedAt: args.updatedAt,
  });

  return {
    reservedLoads,
    remainingLoads: getRemainingLoads(slot.capacityLoads, reservedLoads),
  };
}

export async function reserveOrderSlots(
  ctx: MutationCtx,
  args: {
    branchId: Id<"branches">;
    dropoffSlotId: Id<"timeSlots">;
    deliverySlotId: Id<"timeSlots">;
    loadCount: number;
    updatedAt: number;
  },
) {
  await assertSlotCanReserve(ctx, {
    slotId: args.dropoffSlotId,
    branchId: args.branchId,
    slotType: "dropoff",
    requiredLoads: args.loadCount,
  });
  await assertSlotCanReserve(ctx, {
    slotId: args.deliverySlotId,
    branchId: args.branchId,
    slotType: "delivery",
    requiredLoads: args.loadCount,
  });

  await adjustSlotReservation(ctx, {
    slotId: args.dropoffSlotId,
    deltaLoads: args.loadCount,
    updatedAt: args.updatedAt,
  });
  await adjustSlotReservation(ctx, {
    slotId: args.deliverySlotId,
    deltaLoads: args.loadCount,
    updatedAt: args.updatedAt,
  });
}

export async function releaseOrderSlots(
  ctx: MutationCtx,
  args: {
    dropoffSlotId: Id<"timeSlots">;
    deliverySlotId: Id<"timeSlots">;
    loadCount: number;
    updatedAt: number;
  },
) {
  await adjustSlotReservation(ctx, {
    slotId: args.dropoffSlotId,
    deltaLoads: -args.loadCount,
    updatedAt: args.updatedAt,
  });
  await adjustSlotReservation(ctx, {
    slotId: args.deliverySlotId,
    deltaLoads: -args.loadCount,
    updatedAt: args.updatedAt,
  });
}
