import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, PackageCheck, ReceiptText } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageIntro } from "@/components/page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { formatCurrency, formatSlotLabel } from "@/lib/format";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CustomerNewOrderPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.auth.getCurrentUserProfile, {});
  const addresses = useQuery(api.addresses.listMyAddresses, {});
  const createDraftOrder = useMutation(api.orders.createDraftOrder);
  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);

  const [loadCount, setLoadCount] = useState(2);
  const [addressId, setAddressId] = useState<Id<"addresses"> | "">("");
  const [dropoffSlotId, setDropoffSlotId] = useState<Id<"timeSlots"> | "">("");
  const [deliverySlotId, setDeliverySlotId] = useState<Id<"timeSlots"> | "">("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const deferredLoadCount = useDeferredValue(loadCount);
  const dateRange = useMemo(() => {
    const start = new Date();
    return {
      dateFrom: isoDate(start),
      dateTo: isoDate(addDays(start, 6)),
    };
  }, []);

  const slotArgs =
    profile?.defaultBranchId && deferredLoadCount > 0
      ? {
          branchId: profile.defaultBranchId,
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
          requiredLoads: deferredLoadCount,
        }
      : "skip";

  const dropoffSlots = useQuery(
    api.slots.listAvailableSlots,
    slotArgs === "skip" ? "skip" : { ...slotArgs, slotType: "dropoff" },
  );
  const deliverySlots = useQuery(
    api.slots.listAvailableSlots,
    slotArgs === "skip" ? "skip" : { ...slotArgs, slotType: "delivery" },
  );
  const isLoadingSlots =
    slotArgs !== "skip" &&
    (dropoffSlots === undefined || deliverySlots === undefined);
  const availableDropoffSlots = dropoffSlots ?? [];
  const availableDeliverySlots = deliverySlots ?? [];

  const estimatedTotal = profile ? profile.pricePerLoad * loadCount : 0;

  if (profile === undefined || addresses === undefined) {
    return (
      <div className="grid gap-6">
        <div className="h-56 animate-pulse rounded-[2rem] bg-card/70" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[36rem] animate-pulse rounded-[2rem] bg-card/70" />
          <div className="h-96 animate-pulse rounded-[2rem] bg-card/70" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid gap-6">
        <PageIntro
          eyebrow="Profile required"
          title="We could not load the seeded branch profile yet."
          description="Refresh after the customer bootstrap finishes. The order flow depends on the synced branch profile and pricing snapshot."
        />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="grid gap-6">
        <PageIntro
          eyebrow="New order"
          title="The order form is ready once your address book is."
          description="Phase 1 assumes the customer has at least one saved delivery address because the draft order stores the chosen lobby handoff record directly."
          actions={
            <Link
              to="/customer/profile"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              Add an address first
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="New order"
        title="Reserve capacity, then move into mock checkout."
        description="The form creates a timed hold in load units. That hold protects both the drop-off slot and the delivery slot while the customer finishes payment."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);

            startTransition(async () => {
              try {
                if (!addressId || !dropoffSlotId || !deliverySlotId) {
                  setError("Choose an address, a drop-off slot, and a delivery slot.");
                  return;
                }

                const order = await createDraftOrder({
                  addressId,
                  loadCount,
                  dropoffSlotId,
                  deliverySlotId,
                  specialInstructions: specialInstructions || undefined,
                });

                const session = await createCheckoutSession({
                  orderId: order.orderId,
                });

                await navigate({
                  to: "/customer/orders/$orderId",
                  params: { orderId: order.orderId },
                  search: { checkout: session.sessionId },
                });
              } catch (submissionError) {
                setError(
                  submissionError instanceof Error
                    ? submissionError.message
                    : "Unable to create your draft order.",
                );
              }
            });
          }}
        >
          <div className="grid gap-6">
            <section className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <PackageCheck className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Order details
                  </p>
                  <h2 className="mt-1 text-3xl text-foreground">
                    Service is fixed to self drop-off for Phase 1.
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Number of loads
                  </span>
                  <Input
                    name="loadCount"
                    type="number"
                    min={1}
                    max={8}
                    inputMode="numeric"
                    value={loadCount}
                    onChange={(event) =>
                      setLoadCount(Number(event.target.value || 1))
                    }
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Address
                  </span>
                  <Select
                    name="addressId"
                    value={addressId}
                    onChange={(event) =>
                      setAddressId(event.target.value as Id<"addresses">)
                    }
                    required
                  >
                    <option value="">Choose a saved address</option>
                    {addresses.map((address) => (
                      <option key={address._id} value={address._id}>
                        {address.label} · {address.buildingName}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
                  Special instructions
                </span>
                <Textarea
                  name="specialInstructions"
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Delicates, fragrance requests, or garment handling notes."
                />
              </label>
            </section>

            <section className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-accent/12 p-2 text-accent">
                  <CalendarDays className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Capacity-aware slots
                  </p>
                  <h2 className="mt-1 text-3xl text-foreground">
                    Pick one drop-off and one delivery window.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isLoadingSlots
                      ? `Refreshing capacity for ${loadCount} ${loadCount === 1 ? "load" : "loads"}.`
                      : "Available windows update as load count changes."}
                  </p>
                </div>
              </div>

              {isLoadingSlots ? (
                <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Drop-off slot
                    </span>
                    <div className="h-12 animate-pulse rounded-2xl border border-border bg-input/70" />
                  </div>
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Delivery slot
                    </span>
                    <div className="h-12 animate-pulse rounded-2xl border border-border bg-input/70" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Drop-off slot
                    </span>
                    <Select
                      name="dropoffSlotId"
                      value={dropoffSlotId}
                      onChange={(event) =>
                        setDropoffSlotId(event.target.value as Id<"timeSlots">)
                      }
                      required
                    >
                      <option value="">Choose a drop-off slot</option>
                      {availableDropoffSlots.map((slot) => (
                        <option key={slot.slotId} value={slot.slotId}>
                          {formatSlotLabel(slot)} · {slot.remainingLoads} loads left
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Delivery slot
                    </span>
                    <Select
                      name="deliverySlotId"
                      value={deliverySlotId}
                      onChange={(event) =>
                        setDeliverySlotId(event.target.value as Id<"timeSlots">)
                      }
                      required
                    >
                      <option value="">Choose a delivery slot</option>
                      {availableDeliverySlots.map((slot) => (
                        <option key={slot.slotId} value={slot.slotId}>
                          {formatSlotLabel(slot)} · {slot.remainingLoads} loads left
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {error ? (
                <p aria-live="polite" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drafts hold capacity for a limited time. Mock payment happens
                  on the next screen.
                </p>
              )}
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "Creating draft order…" : "Reserve and continue"}
              </Button>
            </div>
          </div>
        </form>

        <aside className="space-y-4 rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2 text-secondary-foreground">
              <ReceiptText className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Price snapshot
              </p>
              <h2 className="mt-1 text-3xl text-foreground">Order summary</h2>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Active branch
            </p>
            <p className="mt-2 font-display text-3xl text-foreground">
              {profile.branchName}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {formatCurrency(profile.pricePerLoad, profile.currency)} per load.
              Pricing is seeded for Phase 1 and stored on the order at creation
              time.
            </p>
          </div>

          <div className="space-y-3 rounded-[1.75rem] border border-border bg-background/70 p-5">
            <SummaryRow
              label="Loads"
              value={`${loadCount} ${loadCount === 1 ? "load" : "loads"}`}
            />
            <SummaryRow
              label="Estimated total"
              value={formatCurrency(estimatedTotal, profile.currency)}
            />
            <SummaryRow
              label="Delivery mode"
              value="Lobby / security desk only"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/80 pb-3 last:border-none last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
