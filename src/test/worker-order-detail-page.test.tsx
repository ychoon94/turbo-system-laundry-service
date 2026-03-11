import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMyAssignedOrderDetailQuery,
  useMutationMock,
  useParamsMock,
  useQueryMock,
} = vi.hoisted(() => ({
  getMyAssignedOrderDetailQuery: Symbol("getMyAssignedOrderDetailQuery"),
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
    workers: {
      getMyAssignedOrderDetail: getMyAssignedOrderDetailQuery,
    },
    orders: {
      markLaundryReceivedAtShop: Symbol("markLaundryReceivedAtShop"),
      startWashing: Symbol("startWashing"),
      completeWashing: Symbol("completeWashing"),
      completeDrying: Symbol("completeDrying"),
      completeFolding: Symbol("completeFolding"),
      putOnIssueHold: Symbol("putOnIssueHold"),
    },
    issues: {
      generateEvidenceUploadUrl: Symbol("generateEvidenceUploadUrl"),
      createIssueReport: Symbol("createIssueReport"),
    },
  },
}));

import { WorkerOrderDetailPage } from "@/pages/worker-order-detail-page";

const baseOrder = {
  _id: "order_1",
  orderNumber: "TT-20260310-123456",
  currentStatus: "washing",
  paymentStatus: "paid",
  loadCount: 2,
  totalAmount: 37,
  currency: "SGD",
  createdAt: Date.now(),
  specialInstructions: "Handle delicates separately.",
  customer: {
    userId: "customer_1",
    fullName: "Test Customer",
    email: "customer@example.com",
    phone: "+6512345678",
  },
  assignedWorker: {
    userId: "worker_1",
    fullName: "Test Worker",
    email: "worker@example.com",
  },
  dropoffSlot: {
    slotId: "dropoff_slot_1",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
  },
  deliverySlot: {
    slotId: "delivery_slot_1",
    date: "2026-03-10",
    startTime: "18:00",
    endTime: "20:00",
  },
  address: {
    label: "Home",
    contactName: "Test Customer",
    contactPhone: "+6512345678",
    addressLine1: "1 Example Street",
    addressLine2: undefined,
    buildingName: "Example Tower",
    towerBlock: undefined,
    unitNumber: "#01-01",
    lobbyOrSecurityNote: "Leave with concierge.",
  },
  issueReports: [],
  statusHistory: [],
};

describe("WorkerOrderDetailPage", () => {
  beforeEach(() => {
    useParamsMock.mockReset();
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useParamsMock.mockReturnValue({ orderId: "order_1" });
    useMutationMock.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it("disables issue-hold creation when the order is already paused", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getMyAssignedOrderDetailQuery) {
        return {
          ...baseOrder,
          currentStatus: "issue_hold",
        };
      }

      return undefined;
    });

    render(<WorkerOrderDetailPage />);

    expect(
      screen.getByText(
        "This order is already on hold. Resolve the current blocker before creating another issue.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create issue hold" })).toBeDisabled();
  });

  it("keeps issue-hold creation available during valid in-process states", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getMyAssignedOrderDetailQuery) {
        return baseOrder;
      }

      return undefined;
    });

    render(<WorkerOrderDetailPage />);

    expect(
      screen.getByText(
        "Pause and escalate the order when a shop-floor issue blocks washing, drying, or folding.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create issue hold" })).toBeEnabled();
  });
});
