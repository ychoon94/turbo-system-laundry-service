/* eslint-disable react-refresh/only-export-components */

import { Suspense, lazy, useMemo } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type AnyRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { NotFoundPage } from "@/pages/not-found-page";
import { CustomerNewOrderPage } from "@/pages/customer-new-order-page";
import { CustomerOrderDetailPage } from "@/pages/customer-order-detail-page";
import { CustomerOrdersPage } from "@/pages/customer-orders-page";
import { CustomerPaymentsPage } from "@/pages/customer-payments-page";
import { CustomerProfilePage } from "@/pages/customer-profile-page";
import { SignInPage } from "@/pages/sign-in-page";
import { SignUpPage } from "@/pages/sign-up-page";
import {
  ensureCustomerSession,
  type RouterAuthContext,
} from "@/lib/route-guards";

const RouterDevtools =
  import.meta.env.DEV && !import.meta.env.TEST
    ? lazy(async () => {
        const module = await import("@tanstack/router-devtools");

        return {
          default: function Devtools() {
            return <module.TanStackRouterDevtools position="bottom-right" />;
          },
        };
      })
    : null;

type RouterContext = {
  auth: RouterAuthContext;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    throw redirect({
      to: context.auth.userId ? "/customer/orders" : "/sign-in",
    });
  },
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

const signInNestedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in/$",
  component: SignInPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  component: SignUpPage,
});

const signUpNestedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up/$",
  component: SignUpPage,
});

const customerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customer",
  beforeLoad: ({ context }) => ensureCustomerSession(context.auth),
  component: AppShell,
});

const customerIndexRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/customer/orders" });
  },
});

const customerProfileRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/profile",
  component: CustomerProfilePage,
});

const customerOrdersRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/orders",
  component: CustomerOrdersPage,
});

const customerPaymentsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/payments",
  component: CustomerPaymentsPage,
});

const customerNewOrderSearchSchema = z.object({
  reorderFrom: z.string().optional(),
});

const customerNewOrderRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/new-order",
  validateSearch: (search) => customerNewOrderSearchSchema.parse(search),
  component: CustomerNewOrderPage,
});

const orderDetailSearchSchema = z.object({
  checkout: z.enum(["success", "cancelled"]).optional(),
  sessionId: z.string().optional(),
});

const customerOrderDetailRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: "/orders/$orderId",
  validateSearch: (search) => orderDetailSearchSchema.parse(search),
  component: CustomerOrderDetailPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signInNestedRoute,
  signUpRoute,
  signUpNestedRoute,
  customerRoute.addChildren([
    customerIndexRoute,
    customerProfileRoute,
    customerOrdersRoute,
    customerPaymentsRoute,
    customerNewOrderRoute,
    customerOrderDetailRoute,
  ]),
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    context: {
      auth: {
        isLoaded: false,
        userId: null,
      },
    },
  });
}

export function createTestRouter(initialPath = "/") {
  return createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    defaultPreload: false,
    context: {
      auth: {
        isLoaded: false,
        userId: null,
      },
    },
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter({ auth }: { auth: RouterAuthContext }) {
  const context = useMemo(() => ({ auth }), [auth]);

  if (!auth.isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="rounded-[2rem] border border-border bg-card/80 px-8 py-10 text-center shadow-[0_35px_90px_-60px_rgba(18,67,62,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Loading
          </p>
          <h1 className="mt-3 text-3xl text-foreground">
            Preparing your route context
          </h1>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} context={context} />;
}

export function TestRouterProvider({
  router,
  auth,
}: {
  router: AnyRouter;
  auth: RouterAuthContext;
}) {
  return <RouterProvider router={router} context={{ auth }} />;
}

function RootLayout() {
  return (
    <>
      <Outlet />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      ) : null}
    </>
  );
}
