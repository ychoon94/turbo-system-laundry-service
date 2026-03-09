import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestRouterProvider, createTestRouter } from "@/router";

vi.mock("@clerk/clerk-react", () => ({
  SignIn: () => <div data-testid="clerk-sign-in">Mock Clerk Sign In</div>,
  SignUp: () => <div data-testid="clerk-sign-up">Mock Clerk Sign Up</div>,
}));

async function renderRoute(path: string, userId: string | null = null) {
  const router = createTestRouter(path);

  await act(async () => {
    render(
      <TestRouterProvider
        router={router}
        auth={{
          isLoaded: true,
          userId,
        }}
      />,
    );

    await router.load();
  });

  return router;
}

describe("auth route matching", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the sign-in UI for nested Clerk sign-in steps", async () => {
    await renderRoute("/sign-in/factor-one");

    expect(screen.getByText("Customer access")).toBeInTheDocument();
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(
      screen.queryByText("This garment ticket does not exist."),
    ).not.toBeInTheDocument();
  });

  it("renders the sign-up UI for nested Clerk sign-up steps", async () => {
    await renderRoute("/sign-up/continue");

    expect(screen.getByText("Customer onboarding")).toBeInTheDocument();
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
    expect(
      screen.queryByText("This garment ticket does not exist."),
    ).not.toBeInTheDocument();
  });

  it("still redirects unauthenticated customer routes to sign-in", async () => {
    const router = await renderRoute("/customer/orders");

    expect(router.state.location.pathname).toBe("/sign-in");
    expect(screen.getByText("Customer access")).toBeInTheDocument();
  });

  it("still shows not-found for unrelated invalid routes", async () => {
    await renderRoute("/this-route-does-not-exist");

    expect(
      screen.getByText("This garment ticket does not exist."),
    ).toBeInTheDocument();
  });
});
