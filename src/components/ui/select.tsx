import type * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type SelectProps = React.ComponentPropsWithoutRef<"select"> & {
  ref?: React.Ref<HTMLSelectElement>;
};

export function Select({ className, ref, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-2xl border border-border bg-input px-4 py-3 pr-12 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
