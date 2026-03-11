import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { api } from "../convex/_generated/api";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { SetupRequiredPage } from "@/pages/setup-required-page";
import { AppRouter } from "@/router";
import { env } from "@/lib/env";

const queryClient = new QueryClient();
const convex = env.isConfigured ? new ConvexReactClient(env.convexUrl) : null;

function ProfileRouter() {
  const auth = useAuth();
  const profile = useQuery(api.auth.getCurrentUserProfile, auth.userId ? {} : "skip");

  if (auth.userId && profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="rounded-[2rem] border border-border bg-card/80 px-8 py-10 text-center shadow-[0_35px_90px_-60px_rgba(18,67,62,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Loading
          </p>
          <h1 className="mt-3 text-3xl text-foreground">
            Syncing your route context
          </h1>
        </div>
      </div>
    );
  }

  return (
    <AppRouter
      auth={{
        isLoaded: auth.isLoaded,
        userId: auth.userId ?? null,
        role: profile?.role ?? null,
      }}
    />
  );
}

function Providers() {
  const auth = useAuth();

  if (!convex) {
    return <SetupRequiredPage />;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <QueryClientProvider client={queryClient}>
        {auth.userId ? (
          <SessionBootstrap>
            <ProfileRouter />
          </SessionBootstrap>
        ) : (
          <ProfileRouter />
        )}
      </QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}

export function RootProviders() {
  if (!env.isConfigured) {
    return <SetupRequiredPage />;
  }

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey}>
      <Providers />
    </ClerkProvider>
  );
}
