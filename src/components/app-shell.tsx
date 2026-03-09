import { UserButton } from "@clerk/clerk-react";
import { Link, Outlet } from "@tanstack/react-router";
import { Shirt, Sparkles, SwatchBook } from "lucide-react";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { cn } from "@/lib/cn";

const links = [
  { to: "/customer/orders", label: "Orders" },
  { to: "/customer/payments", label: "Payments" },
  { to: "/customer/new-order", label: "New Order" },
  { to: "/customer/profile", label: "Profile" },
] as const;

export function AppShell() {
  return (
    <div className="fabric-noise relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-[-18rem] h-[34rem] rounded-full bg-[radial-gradient(circle,_rgba(253,191,144,0.42)_0%,_rgba(253,191,144,0)_68%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-[28rem] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,_rgba(27,95,87,0.16)_0%,_rgba(27,95,87,0)_70%)] blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <a
          href="#main-content"
          className="sr-only absolute left-4 top-4 z-50 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
        >
          Skip to main content
        </a>
        <header className="animate-fade-up rounded-[2rem] border border-border/70 bg-card/75 px-5 py-4 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.45)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 items-center justify-center rounded-[1.4rem] bg-primary text-primary-foreground shadow-[0_20px_30px_-18px_rgba(16,73,67,0.8)]">
                <Shirt className="size-6" />
              </div>
              <div className="space-y-1">
                <Link to="/customer/orders" className="inline-flex items-center gap-2">
                  <span className="font-display text-[clamp(1.5rem,2vw,2rem)] text-foreground">
                    Thread & Tide
                  </span>
                  <Sparkles className="size-4 text-accent" />
                </Link>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Editorial-grade laundry service for customers who want the
                  queue to feel less like a utility and more like concierge.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
              <nav className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-primary/8 hover:text-foreground",
                    )}
                    activeProps={{
                      className:
                        "bg-primary text-primary-foreground shadow-[0_18px_28px_-18px_rgba(16,73,67,0.8)]",
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-3 rounded-full border border-border/80 bg-background/60 px-3 py-2">
                <div className="hidden items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground sm:flex">
                  <SwatchBook className="size-3.5" />
                  Customer suite
                </div>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox:
                        "h-9 w-9 ring-1 ring-primary/25 shadow-[0_10px_20px_-15px_rgba(16,73,67,0.7)]",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        <SessionBootstrap>
          <main id="main-content" className="flex-1 py-6 sm:py-8">
            <Outlet />
          </main>
        </SessionBootstrap>
      </div>
    </div>
  );
}
