import { formatStatusLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

const statusTone: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  awaiting_payment: "bg-accent/15 text-accent",
  paid: "bg-primary/12 text-primary",
  awaiting_dropoff: "bg-primary text-primary-foreground",
  received_at_shop: "bg-primary/15 text-primary",
  washing: "bg-[rgba(253,191,144,0.2)] text-[rgb(146,92,49)]",
  drying: "bg-[rgba(246,230,178,0.45)] text-[rgb(112,87,27)]",
  folding: "bg-[rgba(203,229,224,0.55)] text-[rgb(28,83,77)]",
  ready_for_delivery: "bg-accent/18 text-accent",
  issue_hold: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/12 text-destructive",
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
