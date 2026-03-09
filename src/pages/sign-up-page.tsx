import { SignUp } from "@clerk/clerk-react";
import { AuthPageShell } from "@/components/auth-page-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export function SignUpPage() {
  return (
    <AuthPageShell
      eyebrow="Customer onboarding"
      title="Create the account that powers your first booking."
      description="After sign-up, the app immediately provisions your customer profile, seeds the branch schedule, and prepares the address book you will reuse for future orders."
      side={[
        {
          title: "Profile sync",
          body: "Clerk remains the identity provider while Convex stores the app-specific customer profile.",
        },
        {
          title: "Single-branch setup",
          body: "The current slice assumes one active branch with seeded drop-off and delivery windows.",
        },
        {
          title: "Load-based capacity",
          body: "Every available slot is measured in load units so pricing and scheduling stay aligned.",
        },
        {
          title: "Customer-only scope",
          body: "Admin, worker, and driver interfaces are intentionally deferred while the customer checkout baseline stabilizes.",
        },
      ]}
      formFirst
    >
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/customer/profile"
        appearance={clerkAppearance}
      />
    </AuthPageShell>
  );
}
