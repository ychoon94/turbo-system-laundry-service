import { formatStatusLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

const statusTone: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  awaiting_payment: "bg-accent/15 text-accent",
  paid: "bg-primary/12 text-primary",
  awaiting_dropoff: "bg-primary text-primary-foreground",
};

export function OrderStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusTone[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
