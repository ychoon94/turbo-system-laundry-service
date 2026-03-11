import { describe, expect, it } from "vitest";
import { ensureCustomerSession, getDefaultRouteForRole } from "@/lib/route-guards";

describe("ensureCustomerSession", () => {
  it("throws a redirect when the user is missing", () => {
    try {
      ensureCustomerSession({
        isLoaded: true,
        userId: null,
        role: null,
      });
      throw new Error("Expected a redirect to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(307);
    }
  });

  it("allows signed-in users through", () => {
    expect(() =>
      ensureCustomerSession({
        isLoaded: true,
        userId: "user_123",
        role: "customer",
      }),
    ).not.toThrow();
  });

  it("maps roles to their default suite routes", () => {
    expect(getDefaultRouteForRole("customer")).toBe("/customer/orders");
    expect(getDefaultRouteForRole("worker")).toBe("/worker/queue");
    expect(getDefaultRouteForRole("admin")).toBe("/admin/orders");
  });
});
