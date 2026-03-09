import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired unpaid holds",
  { minutes: 10 },
  internal.payments.cleanupExpiredHolds,
  {},
);

export default crons;
