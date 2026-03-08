import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  changeSourceValidator,
  orderStatusValidator,
  paymentStatusValidator,
  serviceTypeValidator,
  slotStatusValidator,
  slotTypeValidator,
  userRoleValidator,
  userStatusValidator,
} from "./lib/domain";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    role: userRoleValidator,
    status: userStatusValidator,
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    defaultAddressId: v.optional(v.id("addresses")),
    branchId: v.optional(v.id("branches")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_role", ["role"]),

  addresses: defineTable({
    userId: v.id("users"),
    label: v.string(),
    contactName: v.string(),
    contactPhone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postcode: v.string(),
    city: v.string(),
    state: v.string(),
    buildingName: v.string(),
    towerBlock: v.optional(v.string()),
    unitNumber: v.optional(v.string()),
    lobbyOrSecurityNote: v.string(),
    accessInstructions: v.optional(v.string()),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  branches: defineTable({
    name: v.string(),
    timezone: v.string(),
    currency: v.string(),
    pricePerLoad: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active", ["isActive"]),

  timeSlots: defineTable({
    branchId: v.id("branches"),
    slotType: slotTypeValidator,
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    capacityLoads: v.number(),
    cutoffMinutesBeforeStart: v.number(),
    status: slotStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_branch_date", ["branchId", "date"])
    .index("by_branch_type_date", ["branchId", "slotType", "date"]),

  orders: defineTable({
    orderNumber: v.string(),
    customerId: v.id("users"),
    branchId: v.id("branches"),
    serviceType: serviceTypeValidator,
    dropoffSlotId: v.id("timeSlots"),
    deliverySlotId: v.id("timeSlots"),
    addressId: v.id("addresses"),
    loadCount: v.number(),
    unitPriceSnapshot: v.number(),
    subtotalAmount: v.number(),
    totalAmount: v.number(),
    currency: v.string(),
    specialInstructions: v.optional(v.string()),
    currentStatus: orderStatusValidator,
    paymentStatus: paymentStatusValidator,
    holdExpiresAt: v.optional(v.number()),
    paymentSessionId: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_dropoff_slot", ["dropoffSlotId"])
    .index("by_delivery_slot", ["deliverySlotId"])
    .index("by_payment_session_id", ["paymentSessionId"]),

  orderStatusHistory: defineTable({
    orderId: v.id("orders"),
    fromStatus: v.optional(orderStatusValidator),
    toStatus: orderStatusValidator,
    changeSource: changeSourceValidator,
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_order", ["orderId"]),

  payments: defineTable({
    orderId: v.id("orders"),
    customerId: v.id("users"),
    provider: v.literal("mock_stripe"),
    providerCheckoutSessionId: v.string(),
    status: paymentStatusValidator,
    amount: v.number(),
    currency: v.string(),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_checkout_session", ["providerCheckoutSessionId"]),
});
