import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { formatCurrency, formatStatusLabel } from "@/lib/format";

export function CustomerPaymentsPage() {
  const payments = useQuery(api.payments.getMyPayments, {});

  if (payments === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
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
        eyebrow="Payments"
        title="Every Stripe-backed checkout, grounded in order history."
        description="This view is customer-facing accounting only: payment status, Stripe references, and a direct path back to the related order record."
        actions={
          <Link
            to="/customer/orders"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Back to orders
          </Link>
        }
      />

      {payments.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/12 text-accent">
            <ReceiptText className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl text-foreground">No payments yet.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            Once a Stripe checkout session is opened, its payment record will
            appear here with the matching order number and final status.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment) => (
            <article
              key={payment._id}
              className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <CreditCard className="size-4" />
                    </div>
                    <p className="font-display text-3xl text-foreground">
                      {payment.orderNumber}
                    </p>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                      {formatStatusLabel(payment.paymentStatus)} payment
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      Order status:{" "}
                      <span className="font-medium text-foreground">
                        {formatStatusLabel(payment.orderStatus)}
                      </span>
                    </p>
                    <p>
                      Created:{" "}
                      <span className="font-medium text-foreground">
                        {new Intl.DateTimeFormat("en-SG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(payment.createdAt)}
                      </span>
                    </p>
                    <p>
                      Session:{" "}
                      <span className="font-medium text-foreground">
                        {payment.providerCheckoutSessionId ?? "Not started"}
                      </span>
                    </p>
                    <p>
                      Payment intent:{" "}
                      <span className="font-medium text-foreground">
                        {payment.providerPaymentIntentId ?? "Pending"}
                      </span>
                    </p>
                    <p>
                      Refund:{" "}
                      <span className="font-medium text-foreground">
                        {payment.providerRefundId ?? "Not refunded"}
                      </span>
                    </p>
                    <p>
                      Refunded at:{" "}
                      <span className="font-medium text-foreground">
                        {payment.refundedAt
                          ? new Intl.DateTimeFormat("en-SG", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(payment.refundedAt)
                          : "Pending"}
                      </span>
                    </p>
                  </div>

                  {payment.refundReason ? (
                    <p className="text-sm leading-7 text-muted-foreground">
                      Refund note:{" "}
                      <span className="font-medium text-foreground">
                        {payment.refundReason}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-border bg-background/65 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Amount
                  </p>
                  <p className="font-display text-3xl text-foreground">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                  <Link
                    to="/customer/orders/$orderId"
                    params={{ orderId: payment.orderId }}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "w-full",
                    )}
                  >
                    View order
                    <ExternalLink className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
