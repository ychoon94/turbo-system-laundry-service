import { SignIn } from "@clerk/clerk-react";
import { AuthPageShell } from "@/components/auth-page-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export function SignInPage() {
  return (
    <AuthPageShell
      eyebrow="Customer access"
      title="Laundry checkout with a calmer front door."
      description="The first Phase 1 slice is focused on one clear promise: sign in, book your drop-off and delivery windows, complete a mock payment, and track the order without a cluttered dashboard."
      side={[
        {
          title: "address-book",
          body: "One address book tuned for lobby handoff",
        },
        {
          title: "capacity",
          body: "Load-based slot availability with live capacity",
        },
        {
          title: "payment-boundary",
          body: "Mock checkout today, Stripe boundary preserved for later",
        },
      ]}
    >
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/customer/orders"
        appearance={clerkAppearance}
      />
    </AuthPageShell>
  );
}
