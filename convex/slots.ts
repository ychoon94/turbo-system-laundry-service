import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./lib/auth";
import { getRemainingLoads } from "./lib/orderRules";
import { slotTypeValidator } from "./lib/domain";

const slotSummaryValidator = v.object({
  slotId: v.id("timeSlots"),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  remainingLoads: v.number(),
  cutoffMinutesBeforeStart: v.number(),
});

export const listAvailableSlots = query({
  args: {
    branchId: v.id("branches"),
    slotType: slotTypeValidator,
    dateFrom: v.string(),
    dateTo: v.string(),
    requiredLoads: v.number(),
  },
  returns: v.array(slotSummaryValidator),
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const slots = await ctx.db
      .query("timeSlots")
      .withIndex("by_branch_type_date", (query) =>
        query
          .eq("branchId", args.branchId)
          .eq("slotType", args.slotType)
          .gte("date", args.dateFrom)
          .lte("date", args.dateTo),
      )
      .collect();

    const slotsWithCapacity = await Promise.all(
      slots
        .filter((slot) => slot.status !== "closed")
        .map(async (slot) => ({
          slotId: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          remainingLoads: getRemainingLoads(
            slot.capacityLoads,
            slot.reservedLoads ?? 0,
          ),
          cutoffMinutesBeforeStart: slot.cutoffMinutesBeforeStart,
        })),
    );

    return slotsWithCapacity.filter(
      (slot) => slot.remainingLoads >= args.requiredLoads,
    );
  },
});
