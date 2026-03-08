import type * as React from "react";
import { cn } from "@/lib/cn";

type TextareaProps = React.ComponentPropsWithoutRef<"textarea"> & {
  ref?: React.Ref<HTMLTextAreaElement>;
};

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-32 w-full rounded-[1.5rem] border border-border bg-input px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}
