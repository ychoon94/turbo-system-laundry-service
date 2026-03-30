import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, MapPinned, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { formatSlotLabel, formatStatusLabel } from "@/lib/format";

export function DriverQueuePage() {
  const queue = useQuery(api.drivers.listMyQueue, {});

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
        eyebrow="Driver queue"
        title="Final-mile tasks that are assigned to you right now."
        description="Each task keeps the last-mile surface focused: customer contact, building drop-off notes, proof capture, and delivery recovery if access fails."
      />

      {queue.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl text-foreground">No assigned deliveries right now.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            Delivery-ready orders appear here after an admin assigns them to your route.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map((task) => (
            <Link
              key={task._id}
              to="/driver/tasks/$taskId"
              params={{ taskId: task._id }}
              className="group rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)] transition hover:-translate-y-0.5 hover:border-primary/35"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-3xl text-foreground">{task.orderNumber}</p>
                    <OrderStatusPill status={task.orderStatus} />
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                      {formatStatusLabel(task.taskStatus)}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Customer:{" "}
                    <span className="font-medium text-foreground">{task.customer.fullName}</span>
                    {task.customer.phone ? ` · ${task.customer.phone}` : ""}
                    <br />
                    Delivery slot: {formatSlotLabel(task.deliverySlot)}
                  </p>
                  {task.issueNote ? (
                    <p className="rounded-[1.25rem] border border-border bg-background/70 px-4 py-3 text-sm leading-6 text-foreground">
                      Latest issue note: {task.issueNote}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-border bg-background/65 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <MapPinned className="size-3.5" />
                    Assigned stop
                  </div>
                  <span
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "w-full justify-center",
                    )}
                  >
                    Open delivery task
                    <ArrowRight className="size-4" />
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
