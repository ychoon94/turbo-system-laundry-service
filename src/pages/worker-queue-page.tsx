import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { formatSlotLabel } from "@/lib/format";

export function WorkerQueuePage() {
  const queue = useQuery(api.workers.listMyQueue, {});

  if (queue === undefined) {
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
        eyebrow="Worker queue"
        title="Every assigned garment run, filtered to work you can advance."
        description="The queue stays narrow on purpose: assigned orders, the next operational status, garment notes, and whether an open issue is already blocking the order."
      />

      {queue.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl text-foreground">No assigned orders right now.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            Assigned paid orders will appear here once an admin sends them into the worker queue.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map((order) => (
            <Link
              key={order._id}
              to="/worker/orders/$orderId"
              params={{ orderId: order._id }}
              className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)] transition hover:-translate-y-0.5 hover:border-primary/35"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-3xl text-foreground">
                      {order.orderNumber}
                    </p>
                    <OrderStatusPill status={order.currentStatus} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Customer:{" "}
                    <span className="font-medium text-foreground">{order.customer.fullName}</span>
                    <br />
                    Drop-off: {formatSlotLabel(order.dropoffSlot)}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Loads:{" "}
                    <span className="font-medium text-foreground">
                      {order.loadCount} {order.loadCount === 1 ? "load" : "loads"}
                    </span>
                    <br />
                    Open issues:{" "}
                    <span className="font-medium text-foreground">{order.issueCountOpen}</span>
                  </p>
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-border bg-background/65 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <ClipboardCheck className="size-3.5" />
                    Assigned work
                  </div>
                  <span
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "w-full justify-center",
                    )}
                  >
                    Open details
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
