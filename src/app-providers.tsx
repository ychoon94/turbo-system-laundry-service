import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { AppRouter } from "@/router";
import { SetupRequiredPage } from "@/pages/setup-required-page";
import { env } from "@/lib/env";

const queryClient = new QueryClient();
const convex = env.isConfigured
  ? new ConvexReactClient(env.convexUrl)
  : null;

function Providers() {
  const auth = useAuth();

  if (!convex) {
    return <SetupRequiredPage />;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <QueryClientProvider client={queryClient}>
        <AppRouter
          auth={{
            isLoaded: auth.isLoaded,
            userId: auth.userId ?? null,
          }}
        />
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
