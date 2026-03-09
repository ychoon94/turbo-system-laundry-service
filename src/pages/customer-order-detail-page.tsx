import { useState, useTransition } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
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
  const order = useQuery(api.orders.getMyOrderDetail, {
    orderId: params.orderId as Id<"orders">,
  });
  const createCheckoutSession = useAction(api.payments.createCheckoutSession);
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

  const canResumePayment =
    order.paymentStatus === "pending" &&
    !order.holdExpired &&
    order.currentStatus !== "cancelled";
  const canReorder =
    order.currentStatus === "cancelled" &&
    (order.paymentStatus === "failed" || order.paymentStatus === "refunded");
  const paymentSessionId = search.sessionId ?? order.paymentSessionId;
  const checkoutReturnedSuccessfully = search.checkout === "success";
  const checkoutWasCancelled = search.checkout === "cancelled";

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
              <h2 className="mt-1 text-3xl text-foreground">Stripe checkout</h2>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-sm leading-7 text-muted-foreground">
              Payment is confirmed only after Stripe webhook reconciliation. The
              customer UI can open hosted checkout, but it does not mark the
              order paid on its own.
            </p>
          </div>

          {checkoutReturnedSuccessfully &&
          order.paymentStatus !== "paid" &&
          order.paymentStatus !== "refunded" ? (
            <div className="rounded-[1.75rem] border border-primary/25 bg-primary/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Waiting for Stripe confirmation
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Stripe redirected you back successfully. This page will update
                once the webhook confirms payment for the order.
              </p>
              {paymentSessionId ? (
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Session {paymentSessionId}
                </p>
              ) : null}
            </div>
          ) : null}

          {checkoutReturnedSuccessfully && order.paymentStatus === "paid" ? (
            <div className="rounded-[1.75rem] border border-primary/25 bg-primary/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Payment confirmed
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Stripe confirmed the checkout session and the order is now ready
                for customer drop-off.
              </p>
            </div>
          ) : null}

          {checkoutReturnedSuccessfully && order.paymentStatus === "refunded" ? (
            <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Payment refunded
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Stripe confirmed a late payment after this order had already been
                cancelled, so the charge was refunded automatically.
              </p>
            </div>
          ) : null}

          {checkoutWasCancelled ? (
            <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Checkout cancelled
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                The hosted checkout session was cancelled before payment
                completed.
              </p>
            </div>
          ) : null}

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-sm leading-7 text-muted-foreground">
              {order.paymentStatus === "paid"
                ? "Payment has already cleared through Stripe."
                : order.paymentStatus === "refunded"
                  ? "This cancelled order was refunded automatically after a late Stripe confirmation. Reorder to reserve fresh capacity."
                  : canReorder
                    ? "The first payment failure cancelled this order and released its held capacity. Reorder from the same details to try again."
                    : order.holdExpired || order.currentStatus === "cancelled"
                      ? "This reservation expired before payment completed. Start a fresh order to reserve new capacity."
                  : "Continue to hosted checkout before the timed hold expires."}
            </p>

            {canResumePayment ? (
              <Button
                className="mt-5 w-full"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      const session = await createCheckoutSession({
                        orderId: order._id,
                        origin: window.location.origin,
                      });
                      window.location.assign(session.checkoutUrl);
                    } catch (paymentError) {
                      setError(
                        paymentError instanceof Error
                          ? paymentError.message
                          : "Unable to start Stripe checkout.",
                      );
                    }
                  });
                }}
              >
                {isPending ? "Opening Stripe..." : "Continue to secure checkout"}
              </Button>
            ) : (
              <Link
                to={order.paymentStatus === "paid" ? "/customer/payments" : "/customer/new-order"}
                search={canReorder ? { reorderFrom: order._id } : undefined}
                className={cn(
                  buttonVariants({
                    variant: order.paymentStatus === "paid" ? "secondary" : "primary",
                  }),
                  "mt-5 w-full justify-center",
                )}
              >
                {order.paymentStatus === "paid"
                  ? "View payment history"
                  : canReorder
                    ? "Reorder from these details"
                    : "Book a new order"}
              </Link>
            )}
          </div>

          {paymentSessionId ? (
            <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Stripe session
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {paymentSessionId}
              </p>
            </div>
          ) : null}

          <Link
            to="/customer/payments"
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            View payment history
          </Link>

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
