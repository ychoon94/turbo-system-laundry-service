import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Filter } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  adminOrderStatuses,
  normalizeAdminOrdersSearch,
} from "@/lib/admin-orders-search";
import { formatCurrency, formatSlotLabel } from "@/lib/format";

export function AdminOrdersPage() {
  const workers = useQuery(api.workers.listAssignableWorkers, {});
  const search = useSearch({ from: "/admin/orders" });
  const navigate = useNavigate({ from: "/admin/orders" });

  const orders = useQuery(api.orders.getAdminOrders, {
    status: search.status,
    assignedWorkerId: search.assignedWorkerId as Id<"users"> | undefined,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    search: search.search,
  });

  if (orders === undefined || workers === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="h-40 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-4">
          <div className="h-36 animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-36 animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Admin operations"
        title="The paid-order board, filtered for the live shop floor."
        description="Use this board to see which orders are already commercially cleared, who owns them, and where issue holds are blocking the processing line."
      />

      <section className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent/12 p-2 text-accent">
            <Filter className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Filters
            </p>
            <h2 className="mt-1 text-3xl text-foreground">Refine the queue</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <label className="grid gap-2 lg:col-span-2">
            <span className="text-sm font-medium text-foreground">Search</span>
            <Input
              value={search.search ?? ""}
              onChange={(event) => {
                void navigate({
                  replace: true,
                  search: (current) =>
                    normalizeAdminOrdersSearch({
                      ...current,
                      search: event.target.value || undefined,
                    }),
                });
              }}
              placeholder="Order number, customer, or email"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Status</span>
            <Select
              value={search.status ?? ""}
              onChange={(event) => {
                const nextStatus = event.target.value as
                  | (typeof adminOrderStatuses)[number]
                  | "";

                void navigate({
                  replace: true,
                  search: (current) =>
                    normalizeAdminOrdersSearch({
                      ...current,
                      status: nextStatus || undefined,
                    }),
                });
              }}
            >
              <option value="">All statuses</option>
              {adminOrderStatuses.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Worker</span>
            <Select
              value={search.assignedWorkerId ?? ""}
              onChange={(event) => {
                const nextWorkerId = event.target.value as Id<"users"> | "";

                void navigate({
                  replace: true,
                  search: (current) =>
                    normalizeAdminOrdersSearch({
                      ...current,
                      assignedWorkerId: nextWorkerId || undefined,
                    }),
                });
              }}
            >
              <option value="">All workers</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.fullName}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Date from</span>
              <Input
                type="date"
                value={search.dateFrom ?? ""}
                onChange={(event) => {
                  void navigate({
                    replace: true,
                    search: (current) =>
                      normalizeAdminOrdersSearch({
                        ...current,
                        dateFrom: event.target.value || undefined,
                      }),
                  });
                }}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Date to</span>
              <Input
                type="date"
                value={search.dateTo ?? ""}
                onChange={(event) => {
                  void navigate({
                    replace: true,
                    search: (current) =>
                      normalizeAdminOrdersSearch({
                        ...current,
                        dateTo: event.target.value || undefined,
                      }),
                  });
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <h2 className="text-3xl text-foreground">No operational orders match.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            Adjust the filters or wait for the next paid order to move into the shop-floor
            pipeline.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Link
              key={order._id}
              to="/admin/orders/$orderId"
              params={{ orderId: order._id }}
              search={search}
              className="group rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)] transition hover:-translate-y-0.5 hover:border-primary/35"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-3xl text-foreground">{order.orderNumber}</p>
                    <OrderStatusPill status={order.currentStatus} />
                    {order.issueCountOpen > 0 ? (
                      <span className="rounded-full bg-destructive/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                        {order.issueCountOpen} open issue
                        {order.issueCountOpen === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Customer:{" "}
                    <span className="font-medium text-foreground">
                      {order.customer.fullName}
                    </span>
                    {order.customer.email ? ` · ${order.customer.email}` : ""}
                    <br />
                    Drop-off: {formatSlotLabel(order.dropoffSlot)}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-start rounded-[1.5rem] border border-border bg-background/65 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Assigned
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {order.assignedWorker?.fullName ?? "Unassigned"}
                    </p>
                    <p className="mt-2 font-display text-3xl text-foreground">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                  </div>
                  <ArrowRight className="size-5 text-primary transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
