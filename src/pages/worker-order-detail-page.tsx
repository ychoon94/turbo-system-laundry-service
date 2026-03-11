import { useState, useTransition } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, CheckCircle2, UploadCloud } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { formatCurrency, formatSlotLabel, formatStatusLabel } from "@/lib/format";

const issueTypeOptions = [
  { value: "garment_damage", label: "Garment damage" },
  { value: "machine_issue", label: "Machine issue" },
  { value: "missing_item", label: "Missing item" },
  { value: "access_problem", label: "Access problem" },
  { value: "delay", label: "Delay" },
  { value: "other", label: "Other" },
] as const;

export function WorkerOrderDetailPage() {
  const params = useParams({ from: "/worker/orders/$orderId" });
  const orderId = params.orderId as Id<"orders">;
  const order = useQuery(api.workers.getMyAssignedOrderDetail, { orderId });
  const markLaundryReceivedAtShop = useMutation(api.orders.markLaundryReceivedAtShop);
  const startWashing = useMutation(api.orders.startWashing);
  const completeWashing = useMutation(api.orders.completeWashing);
  const completeDrying = useMutation(api.orders.completeDrying);
  const completeFolding = useMutation(api.orders.completeFolding);
  const generateEvidenceUploadUrl = useMutation(api.issues.generateEvidenceUploadUrl);
  const createIssueReport = useMutation(api.issues.createIssueReport);
  const putOnIssueHold = useMutation(api.orders.putOnIssueHold);
  const [issueType, setIssueType] =
    useState<(typeof issueTypeOptions)[number]["value"]>("garment_damage");
  const [issueDescription, setIssueDescription] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (order === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[34rem] animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-[34rem] animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  const nextAction = getNextWorkerAction(order.currentStatus);
  const canCreateIssueHold = canCreateIssueHoldFromStatus(order.currentStatus);
  const issueHoldAvailabilityMessage = getIssueHoldAvailabilityMessage(order.currentStatus);

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Worker order detail"
        title={`${order.orderNumber} is ready for the next in-shop step.`}
        description="The worker view keeps the operational surface tight: customer garment notes, the current state, issue handling, and exactly one lifecycle action at a time."
        actions={
          <Link
            to="/worker/queue"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <ArrowLeft className="size-4" />
            Back to queue
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="space-y-6 rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusPill status={order.currentStatus} />
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
              {order.customer.fullName}
            </span>
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
              label="Value"
              value={formatCurrency(order.totalAmount, order.currency)}
            />
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Special instructions
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
              {order.specialInstructions ?? "No garment notes were added by the customer."}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Delivery address
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
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

          <section className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Issues
            </p>
            <div className="mt-4 space-y-4">
              {order.issueReports.length === 0 ? (
                <p className="text-sm leading-7 text-muted-foreground">
                  No issue reports have been created for this order.
                </p>
              ) : (
                order.issueReports.map((issue) => (
                  <div
                    key={issue._id}
                    className="rounded-[1.4rem] border border-border bg-card/75 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                        {formatStatusLabel(issue.status)}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatStatusLabel(issue.issueType)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground">
                      {issue.description}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Reported by {issue.reporterName}
                    </p>
                    {issue.evidenceFiles.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {issue.evidenceFiles.map((file) =>
                          file.url ? (
                            <a
                              key={file.storageId}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              Evidence
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
        </article>

        <aside className="space-y-4 rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent/12 p-2 text-accent">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Lifecycle
              </p>
              <h2 className="mt-1 text-3xl text-foreground">Advance the order</h2>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-sm leading-7 text-muted-foreground">
              {nextAction
                ? nextAction.description
                : "This order is already paused or complete for the current in-shop slice."}
            </p>
            {nextAction ? (
              <Button
                className="mt-5 w-full"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);

                  startTransition(async () => {
                    try {
                      await nextAction.run({
                        markLaundryReceivedAtShop,
                        startWashing,
                        completeWashing,
                        completeDrying,
                        completeFolding,
                        orderId,
                      });
                      setMessage(`${nextAction.label} recorded.`);
                    } catch (transitionError) {
                      setError(
                        transitionError instanceof Error
                          ? transitionError.message
                          : "Unable to advance the order.",
                      );
                    }
                  });
                }}
              >
                {isPending ? "Saving..." : nextAction.label}
              </Button>
            ) : null}
          </div>

          <form
            className="space-y-4 rounded-[1.75rem] border border-border bg-background/70 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);

              if (!canCreateIssueHold) {
                setError(issueHoldAvailabilityMessage);
                return;
              }

              startTransition(async () => {
                try {
                  if (!issueDescription.trim()) {
                    setError("Add a clear issue description before submitting.");
                    return;
                  }

                  const storageIds: Id<"_storage">[] = [];
                  for (const file of evidenceFiles) {
                    const uploadUrl = await generateEvidenceUploadUrl({});
                    const uploadResult = await fetch(uploadUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": file.type,
                      },
                      body: file,
                    });

                    const uploadJson = (await uploadResult.json()) as {
                      storageId?: Id<"_storage">;
                    };

                    if (!uploadResult.ok || !uploadJson.storageId) {
                      throw new Error("Evidence upload failed.");
                    }

                    storageIds.push(uploadJson.storageId);
                  }

                  const issueResult = await createIssueReport({
                    orderId,
                    issueType,
                    description: issueDescription.trim(),
                    evidenceFileIds: storageIds,
                  });

                  await putOnIssueHold({
                    orderId,
                    issueReportId: issueResult.issueReportId,
                  });

                  setIssueDescription("");
                  setEvidenceFiles([]);
                  setMessage("Issue report created and the order is now on hold.");
                } catch (issueError) {
                  setError(
                    issueError instanceof Error
                      ? issueError.message
                      : "Unable to create the issue report.",
                  );
                }
              });
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Issue hold
                </p>
                <h2 className="mt-1 text-2xl text-foreground">Pause and escalate</h2>
              </div>
            </div>

            <p className="text-sm leading-7 text-muted-foreground">
              {issueHoldAvailabilityMessage}
            </p>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Issue type</span>
              <Select
                value={issueType}
                disabled={!canCreateIssueHold}
                onChange={(event) =>
                  setIssueType(event.target.value as (typeof issueTypeOptions)[number]["value"])
                }
              >
                {issueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Description</span>
              <Textarea
                value={issueDescription}
                disabled={!canCreateIssueHold}
                onChange={(event) => setIssueDescription(event.target.value)}
                placeholder="Describe the garment or machine issue clearly."
                rows={5}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Evidence files</span>
              <Input
                type="file"
                multiple
                disabled={!canCreateIssueHold}
                onChange={(event) => {
                  setEvidenceFiles(Array.from(event.target.files ?? []));
                }}
              />
            </label>

            {evidenceFiles.length > 0 ? (
              <div className="rounded-[1.25rem] border border-border bg-card/75 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <UploadCloud className="size-3.5" />
                  Pending evidence
                </div>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {evidenceFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isPending || !canCreateIssueHold}>
              {isPending ? "Submitting issue..." : "Create issue hold"}
            </Button>
          </form>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Status history
            </p>
            <div className="mt-4 space-y-4">
              {order.statusHistory.map((entry) => (
                <div key={entry._id} className="border-b border-border/70 pb-3 last:border-none">
                  <p className="text-sm font-semibold text-foreground">
                    {formatStatusLabel(entry.toStatus)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {formatStatusLabel(entry.changeSource)}
                  </p>
                  {entry.notes ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {message ? (
            <p aria-live="polite" className="text-sm font-medium text-primary">
              {message}
            </p>
          ) : null}
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

function getNextWorkerAction(status: string) {
  if (status === "awaiting_dropoff") {
    return {
      label: "Mark received at shop",
      description:
        "Use this when the customer’s laundry has physically arrived at the shop and the order can move into processing.",
      run: ({
        markLaundryReceivedAtShop,
        orderId,
      }: TransitionArgs) => markLaundryReceivedAtShop({ orderId }),
    };
  }

  if (status === "received_at_shop") {
    return {
      label: "Start washing",
      description:
        "Move the order from intake into the washing stage once the load is on the machine.",
      run: ({ startWashing, orderId }: TransitionArgs) => startWashing({ orderId }),
    };
  }

  if (status === "washing") {
    return {
      label: "Complete washing",
      description:
        "Advance the order into drying after the washing cycle is complete.",
      run: ({ completeWashing, orderId }: TransitionArgs) => completeWashing({ orderId }),
    };
  }

  if (status === "drying") {
    return {
      label: "Complete drying",
      description:
        "Move the order into folding once the drying stage is complete.",
      run: ({ completeDrying, orderId }: TransitionArgs) => completeDrying({ orderId }),
    };
  }

  if (status === "folding") {
    return {
      label: "Complete folding",
      description:
        "Mark the order ready for delivery after folding is complete.",
      run: ({ completeFolding, orderId }: TransitionArgs) => completeFolding({ orderId }),
    };
  }

  return null;
}

function canCreateIssueHoldFromStatus(status: string) {
  return ["received_at_shop", "washing", "drying", "folding"].includes(status);
}

function getIssueHoldAvailabilityMessage(status: string) {
  if (status === "issue_hold") {
    return "This order is already on hold. Resolve the current blocker before creating another issue.";
  }

  if (status === "awaiting_dropoff") {
    return "Issue holds become available after intake once the laundry has been received at the shop.";
  }

  if (status === "ready_for_delivery") {
    return "This order has cleared in-shop processing and can no longer be moved into issue hold.";
  }

  return "Pause and escalate the order when a shop-floor issue blocks washing, drying, or folding.";
}

type TransitionArgs = {
  markLaundryReceivedAtShop: ReturnType<typeof useMutation<typeof api.orders.markLaundryReceivedAtShop>>;
  startWashing: ReturnType<typeof useMutation<typeof api.orders.startWashing>>;
  completeWashing: ReturnType<typeof useMutation<typeof api.orders.completeWashing>>;
  completeDrying: ReturnType<typeof useMutation<typeof api.orders.completeDrying>>;
  completeFolding: ReturnType<typeof useMutation<typeof api.orders.completeFolding>>;
  orderId: Id<"orders">;
};

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
