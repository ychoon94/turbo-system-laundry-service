import { useState, useTransition } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, CheckCircle2, UploadCloud } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrderStatusPill } from "@/components/order-status-pill";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatSlotLabel,
  formatStatusLabel,
} from "@/lib/format";

export function DriverTaskDetailPage() {
  const params = useParams({ from: "/driver/tasks/$taskId" });
  const taskId = params.taskId as Id<"deliveryTasks">;
  const task = useQuery(api.drivers.getMyTaskDetail, { taskId });
  const startDelivery = useMutation(api.drivers.startDelivery);
  const completeDelivery = useMutation(api.drivers.completeDelivery);
  const reportDeliveryIssue = useMutation(api.drivers.reportDeliveryIssue);
  const generateProofUploadUrl = useMutation(api.drivers.generateProofUploadUrl);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [completionNote, setCompletionNote] = useState("");
  const [issueFiles, setIssueFiles] = useState<File[]>([]);
  const [issueNote, setIssueNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (task === undefined) {
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

  const canStartDelivery =
    task.taskStatus === "assigned" && task.orderStatus === "ready_for_delivery";
  const canCloseDelivery =
    task.taskStatus === "out_for_delivery" && task.orderStatus === "out_for_delivery";

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Driver task detail"
        title={`${task.orderNumber} carries the final-mile handoff.`}
        description="This delivery view keeps the route focused on the live stop: customer contact details, building access instructions, proof capture, and fallback if delivery cannot be completed."
        actions={
          <Link
            to="/driver/queue"
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
            <OrderStatusPill status={task.orderStatus} />
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
              {formatStatusLabel(task.taskStatus)}
            </span>
          </div>

          <div className="grid gap-4 rounded-[1.75rem] border border-border bg-background/60 p-5 sm:grid-cols-2">
            <InfoBlock label="Customer" value={task.customer.fullName} />
            <InfoBlock
              label="Contact"
              value={task.customer.phone ?? "No phone on file"}
            />
            <InfoBlock label="Delivery slot" value={formatSlotLabel(task.deliverySlot)} />
            <InfoBlock
              label="Order value"
              value={formatCurrency(task.totalAmount, task.currency)}
            />
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Delivery address
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
              {task.addressSnapshot.contactName} · {task.addressSnapshot.contactPhone}
              <br />
              {task.addressSnapshot.addressLine1}
              {task.addressSnapshot.addressLine2
                ? `, ${task.addressSnapshot.addressLine2}`
                : ""}
              <br />
              {task.addressSnapshot.buildingName}
              {task.addressSnapshot.towerBlock
                ? ` · ${task.addressSnapshot.towerBlock}`
                : ""}
              {task.addressSnapshot.unitNumber
                ? ` · ${task.addressSnapshot.unitNumber}`
                : ""}
              <br />
              {task.addressSnapshot.lobbyOrSecurityNote}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Customer notes
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
              {task.specialInstructions ?? "No special instructions were added to this order."}
            </p>
          </div>

          {task.issueNote ? (
            <section className="rounded-[1.75rem] border border-destructive/25 bg-destructive/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-destructive">
                Latest delivery issue
              </p>
              <p className="mt-3 text-sm leading-7 text-foreground">{task.issueNote}</p>
              {task.issueEvidenceFiles.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {task.issueEvidenceFiles.map((file) =>
                    file.url ? (
                      <a
                        key={file.storageId}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        View issue evidence
                      </a>
                    ) : null,
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {task.proofFiles.length > 0 ? (
            <section className="rounded-[1.75rem] border border-border bg-background/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Delivery proof
              </p>
              {task.completionNote ? (
                <p className="mt-3 text-sm leading-7 text-foreground">{task.completionNote}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {task.proofFiles.map((file) =>
                  file.url ? (
                    <a
                      key={file.storageId}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View proof
                    </a>
                  ) : null,
                )}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-4 rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <section className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/12 p-2 text-accent">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Delivery lifecycle
                </p>
                <h2 className="mt-1 text-3xl text-foreground">Advance the stop</h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {canStartDelivery
                ? "Start the route when you are leaving for the delivery window."
                : canCloseDelivery
                  ? "Close the stop with proof of delivery, or send it back for admin reassignment if access fails."
                  : "This stop is waiting on admin reassignment or is already complete."}
            </p>

            {canStartDelivery ? (
              <Button
                className="mt-5 w-full"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    try {
                      await startDelivery({ taskId });
                      setMessage("Delivery is now in progress.");
                    } catch (startError) {
                      setError(
                        startError instanceof Error
                          ? startError.message
                          : "Unable to start delivery.",
                      );
                    }
                  });
                }}
              >
                {isPending ? "Starting delivery..." : "Start delivery"}
              </Button>
            ) : null}
          </section>

          <form
            className="space-y-4 rounded-[1.75rem] border border-border bg-background/70 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);

              if (!canCloseDelivery) {
                setError("This task is not currently ready to close.");
                return;
              }

              startTransition(async () => {
                try {
                  const uploadedProofIds = await uploadFiles(
                    proofFiles,
                    generateProofUploadUrl,
                  );

                  await completeDelivery({
                    taskId,
                    proofFileIds: uploadedProofIds,
                    completionNote: completionNote.trim() || undefined,
                  });
                  setProofFiles([]);
                  setCompletionNote("");
                  setMessage("Delivery completed with proof.");
                } catch (completeError) {
                  setError(
                    completeError instanceof Error
                      ? completeError.message
                      : "Unable to complete delivery.",
                  );
                }
              });
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Complete delivery
            </p>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Proof images</span>
              <Input
                type="file"
                multiple
                disabled={!canCloseDelivery}
                onChange={(event) => {
                  setProofFiles(Array.from(event.target.files ?? []));
                }}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Delivery note</span>
              <Textarea
                value={completionNote}
                disabled={!canCloseDelivery}
                onChange={(event) => setCompletionNote(event.target.value)}
                placeholder="Optional note for the customer handoff."
              />
            </label>

            <PendingFiles files={proofFiles} label="Pending proof" />

            <Button type="submit" className="w-full" disabled={isPending || !canCloseDelivery}>
              {isPending ? "Completing delivery..." : "Complete delivery"}
            </Button>
          </form>

          <form
            className="space-y-4 rounded-[1.75rem] border border-border bg-background/70 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);

              if (!canCloseDelivery) {
                setError("This task is not currently eligible for delivery issue reporting.");
                return;
              }

              startTransition(async () => {
                try {
                  const uploadedIssueIds = await uploadFiles(
                    issueFiles,
                    generateProofUploadUrl,
                  );

                  await reportDeliveryIssue({
                    taskId,
                    issueNote: issueNote.trim(),
                    evidenceFileIds: uploadedIssueIds,
                  });
                  setIssueFiles([]);
                  setIssueNote("");
                  setMessage("Delivery issue reported. The order is back in the ready queue.");
                } catch (issueError) {
                  setError(
                    issueError instanceof Error
                      ? issueError.message
                      : "Unable to report the delivery issue.",
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
                  Delivery issue
                </p>
                <h2 className="mt-1 text-2xl text-foreground">Return for reassignment</h2>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Issue note</span>
              <Textarea
                value={issueNote}
                disabled={!canCloseDelivery}
                onChange={(event) => setIssueNote(event.target.value)}
                placeholder="Explain why the delivery could not be completed."
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Evidence files</span>
              <Input
                type="file"
                multiple
                disabled={!canCloseDelivery}
                onChange={(event) => {
                  setIssueFiles(Array.from(event.target.files ?? []));
                }}
              />
            </label>

            <PendingFiles files={issueFiles} label="Pending issue evidence" />

            <Button type="submit" className="w-full" disabled={isPending || !canCloseDelivery}>
              {isPending ? "Reporting issue..." : "Report delivery issue"}
            </Button>
          </form>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Status history
            </p>
            <div className="mt-4 space-y-4">
              {task.statusHistory.map((entry) => (
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

async function uploadFiles(
  files: File[],
  generateProofUploadUrl: ReturnType<typeof useMutation<typeof api.drivers.generateProofUploadUrl>>,
) {
  const storageIds: Id<"_storage">[] = [];

  for (const file of files) {
    const uploadUrl = await generateProofUploadUrl({});
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
      throw new Error("File upload failed.");
    }

    storageIds.push(uploadJson.storageId);
  }

  return storageIds;
}

function PendingFiles({ files, label }: { files: File[]; label: string }) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] border border-border bg-card/75 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <UploadCloud className="size-3.5" />
        {label}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-foreground">
        {files.map((file) => (
          <li key={`${file.name}-${file.size}`}>{file.name}</li>
        ))}
      </ul>
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
