import type { ReactNode } from "react";

type AuthFeature = {
  title: string;
  body: string;
};

export function AuthPageShell({
  eyebrow,
  title,
  description,
  side,
  children,
  formFirst = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  side: AuthFeature[];
  children: ReactNode;
  formFirst?: boolean;
}) {
  return (
    <div className="fabric-noise flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        className={
          formFirst
            ? "grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(420px,520px)_minmax(0,1fr)] lg:items-center"
            : "grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,520px)] lg:items-center"
        }
      >
        {formFirst ? (
          <>
            <AuthCard>{children}</AuthCard>
            <AuthEditorial
              eyebrow={eyebrow}
              title={title}
              description={description}
              side={side}
              compact={false}
            />
          </>
        ) : (
          <>
            <AuthEditorial
              eyebrow={eyebrow}
              title={title}
              description={description}
              side={side}
              compact
            />
            <AuthCard>{children}</AuthCard>
          </>
        )}
      </div>
    </div>
  );
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="justify-self-center rounded-[2.2rem] border border-border/70 bg-card/90 p-4 shadow-[0_40px_110px_-70px_rgba(18,67,62,0.65)] backdrop-blur sm:p-6">
      {children}
    </div>
  );
}

function AuthEditorial({
  eyebrow,
  title,
  description,
  side,
  compact,
}: {
  eyebrow: string;
  title: string;
  description: string;
  side: AuthFeature[];
  compact: boolean;
}) {
  return (
    <section className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
        {eyebrow}
      </p>
      <h1
        className={
          compact
            ? "max-w-3xl text-[clamp(3rem,7vw,6.4rem)] leading-[0.9]"
            : "max-w-3xl text-[clamp(3rem,7vw,6rem)] leading-[0.9]"
        }
      >
        {title}
      </h1>
      <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
        {description}
      </p>
      <div className={compact ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
        {side.map((item) => (
          <div
            key={item.title}
            className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5"
          >
            {compact ? null : (
              <p className="font-display text-2xl text-foreground">
                {item.title}
              </p>
            )}
            <p
              className={
                compact
                  ? "text-sm leading-6 text-muted-foreground"
                  : "mt-2 text-sm leading-6 text-muted-foreground"
              }
            >
              {compact ? item.body : item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
