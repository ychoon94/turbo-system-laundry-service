import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = MutationCtx | QueryCtx;

export async function getIdentityOrThrow(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("UNAUTHENTICATED");
  }

  return identity;
}

export async function getUserByClerkId(ctx: AuthCtx, clerkUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (query) =>
      query.eq("clerkUserId", clerkUserId),
    )
    .unique();
}

export async function getCurrentUserOrThrow(ctx: AuthCtx) {
  const identity = await getIdentityOrThrow(ctx);
  const user = await getUserByClerkId(ctx, identity.subject);

  if (!user) {
    throw new ConvexError("PROFILE_NOT_FOUND");
  }

  return { identity, user };
}
