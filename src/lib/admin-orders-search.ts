import { z } from "zod";

export const adminOrderStatuses = [
  "awaiting_dropoff",
  "received_at_shop",
  "washing",
  "drying",
  "folding",
  "ready_for_delivery",
  "issue_hold",
] as const;

export const adminOrdersSearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(adminOrderStatuses).optional(),
  assignedWorkerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AdminOrdersSearch = z.infer<typeof adminOrdersSearchSchema>;

export function normalizeAdminOrdersSearch(
  search: AdminOrdersSearch,
): AdminOrdersSearch {
  const trimmedSearch = search.search?.trim();

  return {
    search: trimmedSearch ? trimmedSearch : undefined,
    status: search.status || undefined,
    assignedWorkerId: search.assignedWorkerId || undefined,
    dateFrom: search.dateFrom || undefined,
    dateTo: search.dateTo || undefined,
  };
}
