import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type OrderStatus = Doc<"orders">["currentStatus"];
type ChangeSource = Doc<"orderStatusHistory">["changeSource"];

export async function appendOrderHistory(
  ctx: MutationCtx,
  args: {
    orderId: Id<"orders">;
    fromStatus?: OrderStatus;
    toStatus: OrderStatus;
    changeSource: ChangeSource;
    notes?: string;
    createdAt: number;
  },
) {
  await ctx.db.insert("orderStatusHistory", {
    orderId: args.orderId,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    changeSource: args.changeSource,
    notes: args.notes,
    createdAt: args.createdAt,
  });
}
