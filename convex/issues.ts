import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserWithRoleOrThrow } from "./lib/auth";
import { issueTypeValidator } from "./lib/domain";
import {
  canTransitionToIssueHold,
  isAssignedToWorker,
  isOperationallyAccessible,
} from "./lib/orderOperations";

const openIssueListItemValidator = v.object({
  _id: v.id("issueReports"),
  orderId: v.id("orders"),
  orderNumber: v.string(),
  issueType: v.string(),
  description: v.string(),
  reporterName: v.string(),
  createdAt: v.number(),
});

export const generateEvidenceUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["worker", "admin"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createIssueReport = mutation({
  args: {
    orderId: v.id("orders"),
    issueType: issueTypeValidator,
    description: v.string(),
    evidenceFileIds: v.array(v.id("_storage")),
  },
  returns: v.object({
    issueReportId: v.id("issueReports"),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserWithRoleOrThrow(ctx, ["worker", "admin"]);
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("NOT_FOUND");
    }

    if (!isOperationallyAccessible(order) || !canTransitionToIssueHold(order.currentStatus)) {
      throw new ConvexError("INVALID_STATE_TRANSITION");
    }

    if (user.role === "worker" && !isAssignedToWorker(order, user._id)) {
      throw new ConvexError("FORBIDDEN");
    }

    const now = Date.now();
    const issueReportId = await ctx.db.insert("issueReports", {
      orderId: order._id,
      reporterId: user._id,
      issueType: args.issueType,
      description: args.description,
      status: "open",
      evidenceFileIds: args.evidenceFileIds,
      createdAt: now,
      updatedAt: now,
    });

    return { issueReportId };
  },
});

export const listOpenIssues = query({
  args: {
    orderId: v.optional(v.id("orders")),
  },
  returns: v.array(openIssueListItemValidator),
  handler: async (ctx, args) => {
    await getCurrentUserWithRoleOrThrow(ctx, ["admin"]);
    const issues = await ctx.db
      .query("issueReports")
      .withIndex("by_status", (db) => db.eq("status", "open"))
      .order("desc")
      .collect();

    const filteredIssues = args.orderId
      ? issues.filter((issue) => issue.orderId === args.orderId)
      : issues;

    const items = await Promise.all(
      filteredIssues.map(async (issue) => {
        const [order, reporter] = await Promise.all([
          ctx.db.get(issue.orderId),
          ctx.db.get(issue.reporterId),
        ]);

        if (!order) {
          throw new ConvexError("NOT_FOUND");
        }

        return {
          _id: issue._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          issueType: issue.issueType,
          description: issue.description,
          reporterName: reporter?.fullName ?? "Unknown reporter",
          createdAt: issue.createdAt,
        };
      }),
    );

    return items;
  },
});
