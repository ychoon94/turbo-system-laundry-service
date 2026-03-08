# Lessons Learned

## 2026-03-08
- For docs-only investigations, create a minimal `tasks/todo.md` first so architectural conclusions remain traceable without inflating scope.
- When architecture docs mix future-state and first-slice guidance, force a single bootstrap decision on capacity semantics, reservation timing, and ownership of assignment state before coding.
- Convex type generation needs an initialized deployment context; on a fresh repo, run `npx convex dev --once` before assuming `convex/_generated` exists.
- On this Node setup, `@clerk/react` failed its postinstall while `@clerk/clerk-react` installed cleanly, so package churn should be validated against the local runtime before refactoring auth dependencies.
- Keep Clerk credential-flow tests parameterized by environment secrets and assert route-level outcomes, not a specific account state such as a breached-password warning.
- With Convex `useQuery`, argument changes can transiently return `undefined`; page-wide loading guards should not depend on refetching query branches unless a full-page remount is actually intended.
