import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-[0_20px_40px_-22px_rgba(16,73,67,0.75)] hover:bg-primary/92",
        secondary:
          "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/85",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-primary/8",
        outline:
          "border-border bg-card/80 text-foreground hover:border-primary/45 hover:bg-card",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
