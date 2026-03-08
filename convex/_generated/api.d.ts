/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addresses from "../addresses.js";
import type * as auth from "../auth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_orderHistory from "../lib/orderHistory.js";
import type * as lib_orderRules from "../lib/orderRules.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as slots from "../slots.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addresses: typeof addresses;
  auth: typeof auth;
  "lib/auth": typeof lib_auth;
  "lib/domain": typeof lib_domain;
  "lib/orderHistory": typeof lib_orderHistory;
  "lib/orderRules": typeof lib_orderRules;
  orders: typeof orders;
  payments: typeof payments;
  slots: typeof slots;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
