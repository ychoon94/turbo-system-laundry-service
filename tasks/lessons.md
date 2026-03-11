# Lessons Learned

## 2026-03-08

- For docs-only investigations, create a minimal `tasks/todo.md` first so architectural conclusions remain traceable without inflating scope.
- For documentation audits in product repos, compare `README.md`, `package.json`, and route/schema entry points first; stock template text plus aspirational `docs/` content is a strong stale-doc signal.
- When architecture docs mix future-state and first-slice guidance, force a single bootstrap decision on capacity semantics, reservation timing, and ownership of assignment state before coding.
- Convex type generation needs an initialized deployment context; on a fresh repo, run `npx convex dev --once` before assuming `convex/_generated` exists.
- On this Node setup, `@clerk/react` failed its postinstall while `@clerk/clerk-react` installed cleanly, so package churn should be validated against the local runtime before refactoring auth dependencies.
- Keep Clerk credential-flow tests parameterized by environment secrets and assert route-level outcomes, not a specific account state such as a breached-password warning.
- With Convex `useQuery`, argument changes can transiently return `undefined`; page-wide loading guards should not depend on refetching query branches unless a full-page remount is actually intended.
- When tightening a Convex schema against an existing deployment, either backfill existing documents first or make new fields temporarily optional; `npx convex dev --once` will reject older documents immediately.
- When a frontend change introduces new Convex functions and live e2e tests use the hosted deployment from `VITE_CONVEX_URL`, push the updated functions before running Playwright or the browser will fail with missing-function errors rather than UI regressions.
- In this repo, Convex extension points are currently absent by filename as well as usage pattern, so adding webhooks or scheduled jobs should start by creating `convex/http.ts` and a cron registration file instead of trying to align with a nonexistent local convention.
- On this Windows setup, `rg.exe` can be unavailable or blocked even when present, so repo-wide investigations should fall back to `Get-ChildItem` plus `Select-String` without stalling the trace.
- For Stripe Checkout expiry in this repo, a timed hold created earlier cannot be passed straight through as `expires_at`; reuse open sessions when possible and refresh the hold window with a small server-side buffer before creating a new session.
- Stripe only substitutes `{CHECKOUT_SESSION_ID}` when the placeholder remains literal in the return URL, so building success/cancel URLs with `URLSearchParams` needs a post-pass to undo `%7B...%7D` encoding.
- `npx convex dev --once` is the reliable final sync for Convex function changes in this repo because it catches deployment-blocking TypeScript issues that can be easy to miss during local iteration.
- In this payment state machine, late webhooks must preserve terminal order/payment states: a delayed `checkout.session.completed` cannot reopen a cancelled order, and a delayed `payment_intent.payment_failed` cannot downgrade a terminal failed payment back to pending.

## 2026-03-09

- For TanStack Router list/detail flows with shareable filters, define one small typed search schema/helper and reuse it on both routes so refresh and in-app back links preserve the operator’s current view.
- If UI state is supposed to be URL-backed, keep the URL as the source of truth instead of mirroring it through `useEffect` into local state; React’s lint rules correctly flag that sync pattern as a render-loop risk.
- Stripe `payment_intent.payment_failed` should be treated as a retryable signal in Checkout flows; terminal cancellation and slot release should stay tied to `checkout.session.expired` or timed-hold cleanup.
- Mutation-level webhook tests can be written without a full Convex runtime by invoking exported internal mutation `_handler` functions with a focused mocked `ctx.db` surface and explicit side-effect mocks.
- Live Stripe retry E2E is best kept behind explicit environment flags in this repo (`PLAYWRIGHT_ENABLE_STRIPE_RETRY_E2E`, `PLAYWRIGHT_PENDING_ORDER_ID`, auth secrets) so the default CI lane remains deterministic.
- In this Checkout integration, `payment_intent.payment_failed` cannot rely on PaymentIntent metadata alone; Stripe reliably exposes the owning order through `checkout.sessions.list({ payment_intent })` plus session metadata.
- After backend webhook changes, run `npx convex dev --once` before trusting live browser checks; local codegen/tests can pass while the hosted Convex deployment still serves the previous validator shape.
- When adding new role-based suites to the TanStack Router in this repo, keep auth decisions centralized in `src/app-providers.tsx`, `src/lib/route-guards.ts`, and `src/router.tsx`; page-level role branching makes the route tests fragile and duplicates the shell logic.
- For Convex operational workflows, a small pure helper module for state transitions is worth keeping because it supports cheap rule tests and avoids re-encoding the same status graph across admin, worker, and issue mutations.
- In this repo, staff onboarding is still external to the app, so any new worker/admin feature should explicitly document the Clerk-plus-Convex provisioning dependency instead of implying that test users can be created entirely from local code.

## 2026-03-10

- When one operational step creates a record and a second step performs the state transition, either make the pair atomic or guard the first step with the same transition predicate; otherwise partial success can leak orphan work items into admin queues.
