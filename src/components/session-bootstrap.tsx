import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";

export function SessionBootstrap({ children }: { children: ReactNode }) {
  const ensureProfile = useMutation(api.auth.ensureCurrentUserProfile);
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState<"idle" | "syncing" | "ready" | "error">(
    "idle",
  );

  const runBootstrap = useEffectEvent(async () => {
    setState("syncing");
    try {
      await ensureProfile({
        fullName: user?.fullName ?? user?.firstName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress,
        phone: user?.primaryPhoneNumber?.phoneNumber,
      });
      setState("ready");
    } catch (error) {
      console.error(error);
      setState("error");
    }
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || state === "syncing" || state === "ready") {
      return;
    }

    void runBootstrap();
  }, [isLoaded, isSignedIn, state]);

  if (!isLoaded || state === "idle" || state === "syncing") {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="rounded-[2rem] border border-border bg-card/85 px-8 py-10 text-center shadow-[0_30px_90px_-60px_rgba(18,67,62,0.45)]">
          <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 font-display text-2xl text-foreground">
            Preparing your workspace
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            We are syncing your profile and loading the shared branch context so
            customer, worker, and admin tools are ready as soon as you land.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-[2rem] border border-destructive/30 bg-card/85 p-8 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.45)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
          <Sparkles className="size-3.5" />
          Sync issue
        </div>
        <h2 className="mt-4 text-3xl text-foreground">
          We could not prepare your account.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Check your Convex and Clerk configuration, then refresh. The bootstrap
          mutation is responsible for creating your profile and ensuring the
          shared branch schedule exists.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
