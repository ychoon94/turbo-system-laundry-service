import type * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";

type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    ref?: React.Ref<HTMLButtonElement>;
  };

export function Button({
  className,
  variant,
  size,
  ref,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
