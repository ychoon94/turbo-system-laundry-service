import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type AuthCtx = MutationCtx | QueryCtx;
type UserRole = Doc<"users">["role"];

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

export function assertUserRole(user: Pick<Doc<"users">, "role">, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(user.role)) {
    throw new ConvexError("FORBIDDEN");
  }
}

export async function getCurrentUserWithRoleOrThrow(
  ctx: AuthCtx,
  allowedRoles: UserRole[],
) {
  const result = await getCurrentUserOrThrow(ctx);
  assertUserRole(result.user, allowedRoles);
  return result;
}
