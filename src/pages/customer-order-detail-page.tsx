import { useState, useTransition } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CreditCard, Hourglass, MapPinned } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatLongDate,
  formatSlotLabel,
  formatStatusLabel,
} from "@/lib/format";

export function CustomerOrderDetailPage() {
  const params = useParams({ from: "/customer/orders/$orderId" });
  const search = useSearch({ from: "/customer/orders/$orderId" });
  const checkoutSessionId = search.checkout;
  const navigate = useNavigate();
  const order = useQuery(api.orders.getMyOrderDetail, {
    orderId: params.orderId as Id<"orders">,
  });
  const completeMockCheckout = useMutation(api.payments.completeMockCheckout);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (order === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[30rem] animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-[30rem] animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Order detail"
        title={`${order.orderNumber} stays grounded in one record.`}
        description="The detail page shows the order aggregate root: commercial summary, slot reservations, the current payment state, and the status history that documents every transition."
        actions={
          <Link
            to="/customer/orders"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <ArrowLeft className="size-4" />
            Back to orders
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="space-y-6 rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusPill status={order.currentStatus} />
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
              {formatStatusLabel(order.paymentStatus)} payment
            </span>
            {order.holdExpired ? (
              <span className="rounded-full bg-destructive/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                Hold expired
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 rounded-[1.75rem] border border-border bg-background/60 p-5 sm:grid-cols-2">
            <InfoBlock label="Drop-off slot" value={formatSlotLabel(order.dropoffSlot)} />
            <InfoBlock
              label="Delivery slot"
              value={formatSlotLabel(order.deliverySlot)}
            />
            <InfoBlock
              label="Loads"
              value={`${order.loadCount} ${order.loadCount === 1 ? "load" : "loads"}`}
            />
            <InfoBlock
              label="Price snapshot"
              value={formatCurrency(order.totalAmount, order.currency)}
            />
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <MapPinned className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Delivery address
                </p>
                <p className="mt-2 font-display text-2xl text-foreground">
                  {order.address.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {order.address.contactName} · {order.address.contactPhone}
                  <br />
                  {order.address.addressLine1}
                  {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""}
                  <br />
                  {order.address.buildingName}
                  {order.address.towerBlock ? ` · ${order.address.towerBlock}` : ""}
                  {order.address.unitNumber ? ` · ${order.address.unitNumber}` : ""}
                  <br />
                  {order.address.lobbyOrSecurityNote}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Status history
            </p>
            <div className="mt-5 space-y-4">
              {order.statusHistory.map((entry) => (
                <div key={entry._id} className="flex gap-4">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {entry.toStatus.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatStatusLabel(entry.toStatus)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {formatLongDate(
                        new Date(entry.createdAt).toISOString().slice(0, 10),
                      )}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {entry.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="space-y-4 rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent/12 p-2 text-accent">
              {order.paymentStatus === "paid" ? (
                <CreditCard className="size-4" />
              ) : (
                <Hourglass className="size-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Payment boundary
              </p>
              <h2 className="mt-1 text-3xl text-foreground">Mock checkout</h2>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-sm leading-7 text-muted-foreground">
              The real Stripe integration is deferred, but payment still crosses
              a backend boundary so the public UI never mutates order state on
              its own.
            </p>
          </div>

          {checkoutSessionId && order.paymentStatus !== "paid" ? (
            <div className="rounded-[1.75rem] border border-primary/25 bg-primary/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Session {checkoutSessionId}
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Complete the mocked payment to transition the order into the
                paid and awaiting-dropoff states.
              </p>
              <Button
                className="mt-5 w-full"
                disabled={isPending || order.holdExpired}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await completeMockCheckout({
                        orderId: order._id,
                        sessionId: checkoutSessionId,
                      });
                      await navigate({
                        to: "/customer/orders/$orderId",
                        params: { orderId: order._id },
                        search: {},
                        replace: true,
                      });
                    } catch (paymentError) {
                      setError(
                        paymentError instanceof Error
                          ? paymentError.message
                          : "Unable to complete mock checkout.",
                      );
                    }
                  });
                }}
              >
                {order.holdExpired
                  ? "Hold expired"
                  : isPending
                    ? "Completing…"
                    : "Complete mock payment"}
              </Button>
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
              <p className="text-sm leading-7 text-muted-foreground">
                {order.paymentStatus === "paid"
                  ? "Payment has already cleared through the mock backend flow."
                  : "Open this order from the new-order flow to continue mock checkout."}
              </p>
            </div>
          )}

          {error ? (
            <p aria-live="polite" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}
