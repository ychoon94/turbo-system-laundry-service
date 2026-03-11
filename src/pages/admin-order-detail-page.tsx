import { useState, useTransition } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatLongDate,
  formatSlotLabel,
  formatStatusLabel,
} from "@/lib/format";

const RESUME_OPTIONS = [
  { value: "washing", label: "Resume at washing" },
  { value: "drying", label: "Resume at drying" },
  { value: "folding", label: "Resume at folding" },
  { value: "ready_for_delivery", label: "Resume to ready for delivery" },
] as const;

export function AdminOrderDetailPage() {
  const params = useParams({ from: "/admin/orders/$orderId" });
  const search = useSearch({ from: "/admin/orders/$orderId" });
  const order = useQuery(api.orders.getAdminOrderDetail, {
    orderId: params.orderId as Id<"orders">,
  });
  const assignableWorkers = useQuery(api.workers.listAssignableWorkers, {});
  const openIssues = useQuery(api.issues.listOpenIssues, {
    orderId: params.orderId as Id<"orders">,
  });
  const assignOrderToWorker = useMutation(api.workers.assignOrderToWorker);
  const resumeFromIssueHold = useMutation(api.orders.resumeFromIssueHold);
  const [selectedWorkerId, setSelectedWorkerId] = useState<Id<"users"> | "">("");
  const [selectedIssueId, setSelectedIssueId] = useState<Id<"issueReports"> | "">("");
  const [nextStatus, setNextStatus] = useState<(typeof RESUME_OPTIONS)[number]["value"]>("washing");
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (order === undefined || assignableWorkers === undefined || openIssues === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[32rem] animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-[32rem] animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  const activeIssueId =
    selectedIssueId || (openIssues[0]?._id as Id<"issueReports"> | undefined);

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Admin detail"
        title={`${order.orderNumber} links commerce, assignment, and issue control.`}
        description="This detail view keeps the admin slice practical: who owns the order, where it sits in the shop pipeline, and whether an issue is blocking the worker from progressing it."
        actions={
          <Link
            to="/admin/orders"
            search={search}
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
          </div>

          <div className="grid gap-4 rounded-[1.75rem] border border-border bg-background/60 p-5 sm:grid-cols-2">
            <InfoBlock label="Customer" value={order.customer.fullName} />
            <InfoBlock label="Loads" value={`${order.loadCount}`} />
            <InfoBlock label="Drop-off slot" value={formatSlotLabel(order.dropoffSlot)} />
            <InfoBlock label="Delivery slot" value={formatSlotLabel(order.deliverySlot)} />
            <InfoBlock label="Order total" value={formatCurrency(order.totalAmount, order.currency)} />
            <InfoBlock
              label="Assigned worker"
              value={order.assignedWorker?.fullName ?? "Unassigned"}
            />
          </div>

          <section className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Customer record
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {order.customer.email ?? "No email on file"}
              {order.customer.phone ? ` · ${order.customer.phone}` : ""}
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
            {order.specialInstructions ? (
              <p className="mt-4 rounded-[1.4rem] border border-border bg-card/75 px-4 py-3 text-sm leading-6 text-foreground">
                {order.specialInstructions}
              </p>
            ) : null}
          </section>

          <section className="rounded-[1.75rem] border border-border bg-background/60 p-5">
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
                      {formatStatusLabel(entry.changeSource)} ·{" "}
                      {formatLongDate(new Date(entry.createdAt).toISOString().slice(0, 10))}
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
          </section>
        </article>

        <aside className="space-y-4 rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <section className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Worker assignment
            </p>
            <h2 className="mt-2 text-3xl text-foreground">Assign the owner</h2>
            <div className="mt-4 grid gap-3">
              <Select
                value={selectedWorkerId || order.assignedWorker?.userId || ""}
                onChange={(event) =>
                  setSelectedWorkerId(event.target.value as Id<"users"> | "")
                }
              >
                <option value="">Choose a worker</option>
                {assignableWorkers.map((worker) => (
                  <option key={worker._id} value={worker._id}>
                    {worker.fullName}
                  </option>
                ))}
              </Select>
              <Button
                disabled={isPending || !selectedWorkerId}
                onClick={() => {
                  if (!selectedWorkerId) {
                    return;
                  }

                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    try {
                      await assignOrderToWorker({
                        orderId: order._id,
                        workerId: selectedWorkerId,
                      });
                      setMessage("Worker assignment updated.");
                    } catch (assignmentError) {
                      setError(
                        assignmentError instanceof Error
                          ? assignmentError.message
                          : "Unable to assign the worker.",
                      );
                    }
                  });
                }}
              >
                {isPending ? "Saving assignment..." : "Assign worker"}
              </Button>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/12 p-2 text-destructive">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Issue control
                </p>
                <h2 className="mt-1 text-3xl text-foreground">Resolve the blocker</h2>
              </div>
            </div>

            {openIssues.length === 0 ? (
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                No open issues are blocking this order right now.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                <Select
                  value={selectedIssueId || openIssues[0]._id}
                  onChange={(event) =>
                    setSelectedIssueId(event.target.value as Id<"issueReports"> | "")
                  }
                >
                  {openIssues.map((issue) => (
                    <option key={issue._id} value={issue._id}>
                      {formatStatusLabel(issue.issueType)} · {issue.orderNumber}
                    </option>
                  ))}
                </Select>
                <Select
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(
                      event.target.value as (typeof RESUME_OPTIONS)[number]["value"],
                    )
                  }
                >
                  {RESUME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="Describe the resolution and handoff back to operations."
                />
                <Button
                  disabled={isPending || !activeIssueId || order.currentStatus !== "issue_hold"}
                  onClick={() => {
                    if (!activeIssueId) {
                      return;
                    }

                    setError(null);
                    setMessage(null);
                    startTransition(async () => {
                      try {
                        await resumeFromIssueHold({
                          orderId: order._id,
                          issueReportId: activeIssueId,
                          nextStatus,
                          resolutionNote: resolutionNote || undefined,
                        });
                        setMessage("Issue resolved and the order resumed.");
                        setResolutionNote("");
                      } catch (resumeError) {
                        setError(
                          resumeError instanceof Error
                            ? resumeError.message
                            : "Unable to resume the order.",
                        );
                      }
                    });
                  }}
                >
                  {isPending ? "Resolving issue..." : "Resolve issue and resume"}
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Issue log
            </p>
            <div className="mt-4 space-y-3">
              {order.issueReports.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  No issue reports recorded.
                </p>
              ) : (
                order.issueReports.map((issue) => (
                  <div key={issue._id} className="rounded-[1.4rem] border border-border bg-card/75 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                        {formatStatusLabel(issue.status)}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formatStatusLabel(issue.issueType)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {issue.description}
                    </p>
                    {issue.evidenceFiles.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {issue.evidenceFiles.map((file) =>
                          file.url ? (
                            <a
                              key={file.storageId}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              View evidence
                              <ExternalLink className="size-4" />
                            </a>
                          ) : null,
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          {message ? (
            <p className="text-sm font-medium text-primary">{message}</p>
          ) : null}
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
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
