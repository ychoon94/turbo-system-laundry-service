import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-4 text-foreground">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
        Missing route
      </p>
      <h1 className="text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">
        This garment ticket does not exist.
      </h1>
      <p className="max-w-xl text-base leading-7 text-muted-foreground">
        The page you requested is outside the current customer app or the URL
        is invalid.
      </p>
      <Link
        to="/customer/orders"
        className={cn(buttonVariants({ variant: "secondary" }))}
      >
        Back to orders
      </Link>
    </div>
  );
}
