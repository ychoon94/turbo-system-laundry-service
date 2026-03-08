import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="grid gap-6 rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_35px_90px_-60px_rgba(18,67,62,0.4)] backdrop-blur sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
        <h1 className="max-w-3xl text-[clamp(2.5rem,5vw,4.8rem)] leading-[0.92] text-foreground">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </section>
  );
}
