import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMyTaskDetailQuery,
  useMutationMock,
  useParamsMock,
  useQueryMock,
} = vi.hoisted(() => ({
  getMyTaskDetailQuery: Symbol("getMyTaskDetailQuery"),
  useMutationMock: vi.fn(),
  useParamsMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

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
  useParams: (...args: unknown[]) => useParamsMock(...args),
}));

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    drivers: {
      getMyTaskDetail: getMyTaskDetailQuery,
      startDelivery: Symbol("startDelivery"),
      completeDelivery: Symbol("completeDelivery"),
      reportDeliveryIssue: Symbol("reportDeliveryIssue"),
      generateProofUploadUrl: Symbol("generateProofUploadUrl"),
    },
  },
}));

import { DriverTaskDetailPage } from "@/pages/driver-task-detail-page";

const baseTask = {
  _id: "task_1",
  orderId: "order_1",
  orderNumber: "TT-20260311-123456",
  orderStatus: "ready_for_delivery",
  taskStatus: "assigned",
  loadCount: 2,
  currency: "SGD",
  totalAmount: 37,
  specialInstructions: "Leave at concierge if the customer is not home.",
  customer: {
    userId: "customer_1",
    fullName: "Jamie Customer",
    phone: "+6512345678",
  },
  assignedDriver: {
    userId: "driver_1",
    fullName: "Dylan Driver",
    email: "driver@example.com",
  },
  deliverySlot: {
    slotId: "delivery_slot_1",
    date: "2026-03-12",
    startTime: "18:00",
    endTime: "20:00",
  },
  addressSnapshot: {
    label: "Home",
    contactName: "Jamie Customer",
    contactPhone: "+6512345678",
    addressLine1: "1 River Valley Road",
    addressLine2: undefined,
    buildingName: "River Court",
    towerBlock: undefined,
    unitNumber: "#10-01",
    lobbyOrSecurityNote: "Leave at concierge",
  },
  proofFiles: [],
  issueNote: undefined,
  issueEvidenceFiles: [],
  completionNote: undefined,
  statusHistory: [],
};

describe("DriverTaskDetailPage", () => {
  beforeEach(() => {
    useParamsMock.mockReset();
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useParamsMock.mockReturnValue({ taskId: "task_1" });
    useMutationMock.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the start-delivery action while the task is assigned but not yet live", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getMyTaskDetailQuery) {
        return baseTask;
      }
      return undefined;
    });

    render(<DriverTaskDetailPage />);

    expect(screen.getByRole("button", { name: "Start delivery" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Complete delivery" })).toBeDisabled();
  });

  it("unlocks completion and issue reporting once the stop is out for delivery", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getMyTaskDetailQuery) {
        return {
          ...baseTask,
          orderStatus: "out_for_delivery",
          taskStatus: "out_for_delivery",
        };
      }
      return undefined;
    });

    render(<DriverTaskDetailPage />);

    expect(screen.queryByRole("button", { name: "Start delivery" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete delivery" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Report delivery issue" })).toBeEnabled();
  });
});
