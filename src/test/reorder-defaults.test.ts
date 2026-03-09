import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserOrThrowMock } = vi.hoisted(() => ({
  getCurrentUserOrThrowMock: vi.fn(),
}));

vi.mock("../../convex/lib/auth", () => ({
  getCurrentUserOrThrow: (...args: unknown[]) => getCurrentUserOrThrowMock(...args),
}));

import { getReorderDefaults } from "../../convex/orders";

type QueryHandler<Args extends Record<string, unknown>, Result> = {
  _handler: (ctx: unknown, args: Args) => Promise<Result>;
};

describe("getReorderDefaults", () => {
  beforeEach(() => {
    getCurrentUserOrThrowMock.mockReset();
    getCurrentUserOrThrowMock.mockResolvedValue({
      user: {
        _id: "user_1",
      },
    });
  });

  it("returns prefilled reorder data and only reuses slots with enough capacity", async () => {
    const docsById = {
      order_1: {
        _id: "order_1",
        customerId: "user_1",
        currentStatus: "cancelled",
        paymentStatus: "failed",
        addressId: "address_1",
        dropoffSlotId: "slot_dropoff_1",
        deliverySlotId: "slot_delivery_1",
        loadCount: 3,
        specialInstructions: "Handle delicates separately.",
      },
      address_1: {
        _id: "address_1",
      },
      slot_dropoff_1: {
        _id: "slot_dropoff_1",
        status: "open",
        capacityLoads: 8,
        reservedLoads: 4,
      },
      slot_delivery_1: {
        _id: "slot_delivery_1",
        status: "open",
        capacityLoads: 6,
        reservedLoads: 4,
      },
    };

    const result = await (
      getReorderDefaults as unknown as QueryHandler<
        {
          orderId: string;
        },
        {
          orderId: string;
          addressId?: string;
          loadCount: number;
          specialInstructions?: string;
          dropoffSlotId?: string;
          deliverySlotId?: string;
          dropoffSlotReusable: boolean;
          deliverySlotReusable: boolean;
          dropoffSlotMessage?: string;
          deliverySlotMessage?: string;
        } | null
      >
    )._handler(
      {
        db: {
          get: async (id: string) => docsById[id as keyof typeof docsById] ?? null,
        },
      },
      {
        orderId: "order_1",
      },
    );

    expect(result).toEqual({
      orderId: "order_1",
      addressId: "address_1",
      loadCount: 3,
      specialInstructions: "Handle delicates separately.",
      dropoffSlotId: "slot_dropoff_1",
      deliverySlotId: undefined,
      dropoffSlotReusable: true,
      deliverySlotReusable: false,
      dropoffSlotMessage: undefined,
      deliverySlotMessage: "The original delivery slot no longer has enough capacity.",
    });
  });

  it("rejects reorder access for another customer's cancelled order", async () => {
    await expect(
      (
        getReorderDefaults as unknown as QueryHandler<
          {
            orderId: string;
          },
          unknown
        >
      )._handler(
        {
          db: {
            get: async () => ({
              _id: "order_2",
              customerId: "user_other",
              currentStatus: "cancelled",
              paymentStatus: "failed",
            }),
          },
        },
        {
          orderId: "order_2",
        },
      ),
    ).rejects.toMatchObject({
      data: "FORBIDDEN",
    });
  });
});
