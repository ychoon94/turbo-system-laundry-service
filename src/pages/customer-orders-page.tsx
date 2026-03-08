import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { formatCurrency, formatSlotLabel } from "@/lib/format";

export function CustomerOrdersPage() {
  const orders = useQuery(api.orders.getMyOrders, {});

  if (orders === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-4">
          <div className="h-40 animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-40 animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Orders"
        title="A live view of every booking in the customer slice."
        description="This list is intentionally narrow: orders, payments, holds, and the upcoming drop-off schedule. Worker and driver detail stays out of frame until later phases."
        actions={
          <Link
            to="/customer/new-order"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            Book a new order
          </Link>
        }
      />

      {orders.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl text-foreground">No orders yet.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            Save an address, then create the first draft order to see the timed
            hold, mock checkout, and status history take shape.
          </p>
          <Link
            to="/customer/new-order"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "mt-6 inline-flex",
            )}
          >
            Start your first order
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Link
              key={order._id}
              to="/customer/orders/$orderId"
              params={{ orderId: order._id }}
              className="group rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)] transition hover:-translate-y-0.5 hover:border-primary/35"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-3xl text-foreground">
                      {order.orderNumber}
                    </p>
                    <OrderStatusPill status={order.currentStatus} />
                    {order.holdExpired ? (
                      <span className="rounded-full bg-destructive/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                        Hold expired
                      </span>
                    ) : null}
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Drop-off: {formatSlotLabel(order.dropoffSlot)}
                    <br />
                    Delivery: {formatSlotLabel(order.deliverySlot)}
                  </p>
                </div>
                <div className="flex items-center gap-4 self-start rounded-[1.5rem] border border-border bg-background/65 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Total
                    </p>
                    <p className="font-display text-3xl text-foreground">
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
