import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  profileQuery,
  addressesQuery,
  slotQuery,
  createDraftOrderMutation,
  createCheckoutSessionMutation,
  navigateMock,
  mutationMock,
  useQueryMock,
  useMutationMock,
} = vi.hoisted(() => ({
  profileQuery: Symbol("profileQuery"),
  addressesQuery: Symbol("addressesQuery"),
  slotQuery: Symbol("slotQuery"),
  createDraftOrderMutation: Symbol("createDraftOrderMutation"),
  createCheckoutSessionMutation: Symbol("createCheckoutSessionMutation"),
  navigateMock: vi.fn(),
  mutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

let slotQueryState: "ready" | "refetching" = "ready";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useDeferredValue: (value: unknown) => value,
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
  }) => (
    <a href={String(to)} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    auth: {
      getCurrentUserProfile: profileQuery,
    },
    addresses: {
      listMyAddresses: addressesQuery,
    },
    slots: {
      listAvailableSlots: slotQuery,
    },
    orders: {
      createDraftOrder: createDraftOrderMutation,
    },
    payments: {
      createCheckoutSession: createCheckoutSessionMutation,
    },
  },
}));

import { CustomerNewOrderPage } from "@/pages/customer-new-order-page";

const profile = {
  userId: "user_1",
  clerkUserId: "clerk_1",
  role: "customer",
  fullName: "Test User",
  email: "testuser123@gmail.com",
  phone: "+6512345678",
  defaultAddressId: undefined,
  defaultBranchId: "branch_1",
  branchName: "Thread & Tide Atelier",
  pricePerLoad: 18.5,
  currency: "SGD",
};

const addresses = [
  {
    _id: "address_1",
    label: "Home",
    buildingName: "123 Example Tower",
  },
];

const dropoffSlots = [
  {
    slotId: "dropoff_slot_1",
    date: "2026-03-10",
    startTime: "13:00",
    endTime: "15:00",
    remainingLoads: 10,
    cutoffMinutesBeforeStart: 120,
  },
];

const deliverySlots = [
  {
    slotId: "delivery_slot_1",
    date: "2026-03-10",
    startTime: "20:00",
    endTime: "22:00",
    remainingLoads: 10,
    cutoffMinutesBeforeStart: 120,
  },
];

describe("CustomerNewOrderPage", () => {
  beforeEach(() => {
    slotQueryState = "ready";
    mutationMock.mockReset();
    navigateMock.mockReset();
    useMutationMock.mockReset();
    useMutationMock.mockImplementation(() => mutationMock);
    useQueryMock.mockImplementation((query: symbol, args: unknown) => {
      if (query === profileQuery) {
        return profile;
      }

      if (query === addressesQuery) {
        return addresses;
      }

      if (query === slotQuery && args && typeof args === "object") {
        const slotArgs = args as {
          requiredLoads: number;
          slotType: "dropoff" | "delivery";
        };

        if (
          slotQueryState === "refetching" &&
          slotArgs.requiredLoads === 3
        ) {
          return undefined;
        }

        return slotArgs.slotType === "dropoff" ? dropoffSlots : deliverySlots;
      }

      return undefined;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the page content mounted while slot capacity refreshes", () => {
    render(<CustomerNewOrderPage />);

    expect(
      screen.getByRole("heading", {
        name: "Reserve capacity, then move into mock checkout.",
      }),
    ).toBeInTheDocument();

    slotQueryState = "refetching";

    fireEvent.change(screen.getByRole("spinbutton", { name: /Number of loads/i }), {
      target: { value: "3" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Reserve capacity, then move into mock checkout.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Refreshing capacity for 3 loads."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Pick one drop-off and one delivery window.",
      }),
    ).toBeInTheDocument();
  });
});
