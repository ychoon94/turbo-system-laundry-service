import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICE_PER_LOAD,
  DEFAULT_TIMEZONE,
  userRoleValidator,
} from "./lib/domain";
import { getIdentityOrThrow, getUserByClerkId } from "./lib/auth";

const profileValidator = v.object({
  userId: v.id("users"),
  clerkUserId: v.string(),
  role: userRoleValidator,
  fullName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  defaultAddressId: v.optional(v.id("addresses")),
  defaultBranchId: v.id("branches"),
  branchName: v.string(),
  pricePerLoad: v.number(),
  currency: v.string(),
});

export const getCurrentUserProfile = query({
  args: {},
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await getUserByClerkId(ctx, identity.subject);
    if (!user || !user.branchId) {
      return null;
    }

    const branch = await ctx.db.get(user.branchId);
    if (!branch) {
      return null;
    }

    return {
      userId: user._id,
      clerkUserId: user.clerkUserId,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      defaultAddressId: user.defaultAddressId,
      defaultBranchId: branch._id,
      branchName: branch.name,
      pricePerLoad: branch.pricePerLoad,
      currency: branch.currency,
    };
  },
});

export const ensureCurrentUserProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    role: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const now = Date.now();
    const branchId = await ensureDefaultBranchAndSlots(ctx, now);
    const existingUser = await getUserByClerkId(ctx, identity.subject);

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        fullName: args.fullName ?? existingUser.fullName,
        email: args.email ?? existingUser.email,
        phone: args.phone ?? existingUser.phone,
        branchId,
        updatedAt: now,
      });

      return {
        userId: existingUser._id,
        role: existingUser.role,
      };
    }

    const userId = await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      role: "customer",
      status: "active",
      fullName: args.fullName ?? "Customer",
      email: args.email,
      phone: args.phone,
      branchId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      userId,
      role: "customer",
    };
  },
});

async function ensureDefaultBranchAndSlots(
  ctx: MutationCtx,
  now: number,
) {
  const existingBranch = await ctx.db
    .query("branches")
    .withIndex("by_active", (query) => query.eq("isActive", true))
    .unique();

  const branchId =
    existingBranch?._id ??
    (await ctx.db.insert("branches", {
      name: "Thread & Tide Atelier",
      timezone: DEFAULT_TIMEZONE,
      currency: DEFAULT_CURRENCY,
      pricePerLoad: DEFAULT_PRICE_PER_LOAD,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));

  const dateFrom = new Date(now).toISOString().slice(0, 10);
  const slotSeedCheck = await ctx.db
    .query("timeSlots")
    .withIndex("by_branch_date", (query) =>
      query.eq("branchId", branchId).gte("date", dateFrom),
    )
    .take(1);

  if (slotSeedCheck.length === 0) {
    const dayOffsets = Array.from({ length: 7 }, (_, index) => index);
    const templates = [
      { slotType: "dropoff" as const, startTime: "09:00", endTime: "11:00" },
      { slotType: "dropoff" as const, startTime: "13:00", endTime: "15:00" },
      { slotType: "delivery" as const, startTime: "18:00", endTime: "20:00" },
      { slotType: "delivery" as const, startTime: "20:00", endTime: "22:00" },
    ];

    await Promise.all(
      dayOffsets.flatMap((offset) => {
        const date = new Date(now + offset * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        return templates.map((template) =>
          ctx.db.insert("timeSlots", {
            branchId,
            slotType: template.slotType,
            date,
            startTime: template.startTime,
            endTime: template.endTime,
            capacityLoads: 10,
            cutoffMinutesBeforeStart: 120,
            status: "open",
            createdAt: now,
            updatedAt: now,
          }),
        );
      }),
    );
  }

  return branchId;
}
