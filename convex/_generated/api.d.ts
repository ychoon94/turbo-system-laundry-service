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
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as issues from "../issues.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_orderHistory from "../lib/orderHistory.js";
import type * as lib_orderOperations from "../lib/orderOperations.js";
import type * as lib_orderRules from "../lib/orderRules.js";
import type * as lib_paymentRules from "../lib/paymentRules.js";
import type * as lib_slotReservations from "../lib/slotReservations.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as paymentsNode from "../paymentsNode.js";
import type * as slots from "../slots.js";
import type * as workers from "../workers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addresses: typeof addresses;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  issues: typeof issues;
  "lib/auth": typeof lib_auth;
  "lib/domain": typeof lib_domain;
  "lib/orderHistory": typeof lib_orderHistory;
  "lib/orderOperations": typeof lib_orderOperations;
  "lib/orderRules": typeof lib_orderRules;
  "lib/paymentRules": typeof lib_paymentRules;
  "lib/slotReservations": typeof lib_slotReservations;
  orders: typeof orders;
  payments: typeof payments;
  paymentsNode: typeof paymentsNode;
  slots: typeof slots;
  workers: typeof workers;
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
