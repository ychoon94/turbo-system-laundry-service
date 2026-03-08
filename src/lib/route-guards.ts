import { redirect } from "@tanstack/react-router";

export type RouterAuthContext = {
  isLoaded: boolean;
  userId: string | null;
};

export function ensureCustomerSession(auth: RouterAuthContext) {
  if (!auth.userId) {
    throw redirect({ to: "/sign-in" });
  }
}
