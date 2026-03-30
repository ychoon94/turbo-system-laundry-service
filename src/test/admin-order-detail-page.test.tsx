import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAdminOrderDetailQuery,
  listAssignableWorkersQuery,
  listAssignableDriversQuery,
  listOpenIssuesQuery,
  useMutationMock,
  useParamsMock,
  useQueryMock,
  useSearchMock,
} = vi.hoisted(() => ({
  getAdminOrderDetailQuery: Symbol("getAdminOrderDetailQuery"),
  listAssignableWorkersQuery: Symbol("listAssignableWorkersQuery"),
  listAssignableDriversQuery: Symbol("listAssignableDriversQuery"),
  listOpenIssuesQuery: Symbol("listOpenIssuesQuery"),
  useMutationMock: vi.fn(),
  useParamsMock: vi.fn(),
  useQueryMock: vi.fn(),
  useSearchMock: vi.fn(),
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
  useSearch: (...args: unknown[]) => useSearchMock(...args),
}));

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    orders: {
      getAdminOrderDetail: getAdminOrderDetailQuery,
      resumeFromIssueHold: Symbol("resumeFromIssueHold"),
    },
    workers: {
      listAssignableWorkers: listAssignableWorkersQuery,
      assignOrderToWorker: Symbol("assignOrderToWorker"),
    },
    drivers: {
      listAssignableDrivers: listAssignableDriversQuery,
      assignOrderToDriver: Symbol("assignOrderToDriver"),
    },
    issues: {
      listOpenIssues: listOpenIssuesQuery,
    },
  },
}));

import { AdminOrderDetailPage } from "@/pages/admin-order-detail-page";

const baseOrder = {
  _id: "order_1",
  orderNumber: "TT-20260311-123456",
  currentStatus: "ready_for_delivery",
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
  deliveryTask: {
    _id: "task_1",
    status: "unassigned",
    assignedDriver: null,
    deliverySlot: {
      slotId: "delivery_slot_1",
      date: "2026-03-10",
      startTime: "18:00",
      endTime: "20:00",
    },
    addressSnapshot: {
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
    proofFiles: [],
    issueNote: undefined,
    issueEvidenceFiles: [],
    completionNote: undefined,
    createdAt: Date.now(),
    startedAt: undefined,
    issueReportedAt: undefined,
    completedAt: undefined,
  },
  statusHistory: [],
};

describe("AdminOrderDetailPage", () => {
  beforeEach(() => {
    useParamsMock.mockReset();
    useSearchMock.mockReset();
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useParamsMock.mockReturnValue({ orderId: "order_1" });
    useSearchMock.mockReturnValue({});
    useMutationMock.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it("enables driver assignment when the order is ready for delivery", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getAdminOrderDetailQuery) {
        return baseOrder;
      }
      if (query === listAssignableWorkersQuery) {
        return [];
      }
      if (query === listAssignableDriversQuery) {
        return [{ userId: "driver_1", fullName: "Driver One", email: "driver@example.com" }];
      }
      if (query === listOpenIssuesQuery) {
        return [];
      }
      return undefined;
    });

    render(<AdminOrderDetailPage />);

    expect(
      screen.getByText(
        "Assign or reassign the driver now that the order has cleared in-shop processing.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "driver_1" },
    });

    expect(screen.getByRole("button", { name: "Assign driver" })).toBeEnabled();
  });

  it("locks driver reassignment while the stop is already out for delivery", () => {
    useQueryMock.mockImplementation((query: symbol) => {
      if (query === getAdminOrderDetailQuery) {
        return {
          ...baseOrder,
          currentStatus: "out_for_delivery",
          deliveryTask: {
            ...baseOrder.deliveryTask,
            status: "out_for_delivery",
            assignedDriver: {
              userId: "driver_1",
              fullName: "Driver One",
              email: "driver@example.com",
            },
          },
        };
      }
      if (query === listAssignableWorkersQuery) {
        return [];
      }
      if (query === listAssignableDriversQuery) {
        return [{ userId: "driver_1", fullName: "Driver One", email: "driver@example.com" }];
      }
      if (query === listOpenIssuesQuery) {
        return [];
      }
      return undefined;
    });

    render(<AdminOrderDetailPage />);

    expect(
      screen.getByText(
        "The driver already has this stop live on the route. Reassignment is locked until it returns to ready.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeDisabled();
  });
});
