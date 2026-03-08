import { describe, expect, it } from "vitest";
import { ensureCustomerSession } from "@/lib/route-guards";

describe("ensureCustomerSession", () => {
  it("throws a redirect when the user is missing", () => {
    try {
      ensureCustomerSession({
        isLoaded: true,
        userId: null,
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
      }),
    ).not.toThrow();
  });
});
