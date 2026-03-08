import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export function SetupRequiredPage() {
  return (
    <div className="fabric-noise flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="relative w-full max-w-4xl rounded-[2.5rem] border border-border/70 bg-card/90 p-8 shadow-[0_40px_120px_-65px_rgba(18,67,62,0.6)] sm:p-12">
        <div className="pointer-events-none absolute -right-16 top-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(230,118,90,0.32)_0%,_rgba(230,118,90,0)_75%)] blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Environment setup required
        </p>
        <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95] text-foreground">
          Thread & Tide is wired, but it still needs its live keys.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Add the Clerk publishable key and Convex URL from
          <span className="mx-1 font-semibold text-foreground">`.env.local`</span>
          so the customer checkout flow can boot with real auth and realtime
          data.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {env.missingKeys.map((key) => (
            <div
              key={key}
              className="rounded-[1.75rem] border border-border bg-background/65 p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Missing variable
              </p>
              <p className="mt-2 font-display text-2xl text-foreground">{key}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => window.location.reload()}>
            Refresh after configuring
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                "https://docs.convex.dev/production/integrations/clerk",
                "_blank",
              )
            }
          >
            Clerk + Convex guide
          </Button>
        </div>
      </div>
    </div>
  );
}
