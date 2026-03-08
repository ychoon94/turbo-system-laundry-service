# Task Checklist

## Current Task
- [completed] Fix the `/customer/new-order` full-screen flash that happens when the load count changes.

## Steps
- [completed] Reproduce the flash on `/customer/new-order` while changing the number of loads.
- [completed] Trace which component or provider remounts when the load count changes.
- [completed] Identify the concrete root cause in the page/query/render path.
- [completed] Implement the minimal fix that preserves slot refreshes without a full-screen flash.
- [completed] Add regression coverage for the interaction if it can be tested reliably.
- [completed] Verify the fix in the browser and with automated tests.

## Results
- Reproduced the load-count flash on `/customer/new-order`; the whole page visibly reloads instead of only updating slot-dependent content.
- Confirmed the root cause in `CustomerNewOrderPage`: changing `requiredLoads` causes both slot queries to return `undefined` briefly, and the page-wide loading guard replaced the full route with the skeleton.
- Replaced the broad loading branch with a local slot-loading state so the page intro, form, and summary stay mounted while slot capacity refreshes.
- Added a regression test that verifies the page stays visible while slot data refetches after a load-count change.
- Verified on March 8, 2026 in Playwright with the authenticated flow that changing the load count keeps `/customer/new-order` mounted and no longer triggers the full-screen flash.
