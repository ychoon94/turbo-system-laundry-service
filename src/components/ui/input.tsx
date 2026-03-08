import type * as React from "react";
import { cn } from "@/lib/cn";

type InputProps = React.ComponentPropsWithoutRef<"input"> & {
  ref?: React.Ref<HTMLInputElement>;
};

export function Input({ className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}
