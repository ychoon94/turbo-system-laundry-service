import { redirect } from "@tanstack/react-router";

export type AppRole = "customer" | "worker" | "admin" | "driver" | null;

export type RouterAuthContext = {
  isLoaded: boolean;
  userId: string | null;
  role: AppRole;
};

export function getDefaultRouteForRole(role: AppRole) {
  switch (role) {
    case "worker":
      return "/worker/queue";
    case "admin":
      return "/admin/orders";
    case "driver":
      return "/sign-in";
    case "customer":
    default:
      return "/customer/orders";
  }
}

export function ensureSignedInSession(auth: RouterAuthContext) {
  if (!auth.userId) {
    throw redirect({ to: "/sign-in" });
  }
}

export function ensureRoleSession(auth: RouterAuthContext, role: Exclude<AppRole, null>) {
  ensureSignedInSession(auth);

  if (auth.role !== role) {
    throw redirect({ to: getDefaultRouteForRole(auth.role) });
  }
}

export function ensureCustomerSession(auth: RouterAuthContext) {
  ensureRoleSession(auth, "customer");
}
