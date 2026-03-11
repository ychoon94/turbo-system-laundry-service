import { SignIn } from "@clerk/clerk-react";
import { AuthPageShell } from "@/components/auth-page-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export function SignInPage() {
  return (
    <AuthPageShell
      eyebrow="Secure access"
      title="Checkout, operations, and fulfillment start from one sign-in."
      description="Customers can book and track orders here, while workers and admins are routed into the operational tools attached to the same account."
      side={[
        {
          title: "customers",
          body: "Book drop-off windows, pay through hosted Stripe checkout, and track each order in one place.",
        },
        {
          title: "workers",
          body: "Advance assigned loads through intake, washing, drying, folding, and issue escalation.",
        },
        {
          title: "admins",
          body: "Assign owners, resolve issue holds, and monitor the paid-order board without a separate portal.",
        },
      ]}
    >
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </AuthPageShell>
  );
}
