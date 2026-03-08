import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./lib/auth";

const addressSummaryValidator = v.object({
  _id: v.id("addresses"),
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
});

export const listMyAddresses = query({
  args: {},
  returns: v.array(addressSummaryValidator),
  handler: async (ctx) => {
    const { user } = await getCurrentUserOrThrow(ctx);

    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user", (query) => query.eq("userId", user._id))
      .collect();

    return addresses.map((address) => ({
      _id: address._id,
      label: address.label,
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      postcode: address.postcode,
      city: address.city,
      state: address.state,
      buildingName: address.buildingName,
      towerBlock: address.towerBlock,
      unitNumber: address.unitNumber,
      lobbyOrSecurityNote: address.lobbyOrSecurityNote,
      accessInstructions: address.accessInstructions,
      isDefault: address.isDefault,
    }));
  },
});

export const createAddress = mutation({
  args: {
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
  },
  returns: v.object({
    addressId: v.id("addresses"),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserOrThrow(ctx);
    const now = Date.now();
    const existingAddresses = await ctx.db
      .query("addresses")
      .withIndex("by_user", (query) => query.eq("userId", user._id))
      .collect();

    const shouldBeDefault = args.isDefault || existingAddresses.length === 0;

    if (shouldBeDefault) {
      await Promise.all(
        existingAddresses.map((address) =>
          ctx.db.patch(address._id, { isDefault: false, updatedAt: now }),
        ),
      );
    }

    const addressId = await ctx.db.insert("addresses", {
      userId: user._id,
      label: args.label,
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      postcode: args.postcode,
      city: args.city,
      state: args.state,
      buildingName: args.buildingName,
      towerBlock: args.towerBlock,
      unitNumber: args.unitNumber,
      lobbyOrSecurityNote: args.lobbyOrSecurityNote,
      accessInstructions: args.accessInstructions,
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    });

    if (shouldBeDefault) {
      await ctx.db.patch(user._id, {
        defaultAddressId: addressId,
        updatedAt: now,
      });
    }

    return { addressId };
  },
});
