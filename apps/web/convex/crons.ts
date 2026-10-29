import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled hygiene for the auth tables.
 *
 * Nothing here is load-bearing for correctness -- every reader treats expired
 * or consumed rows as absent -- but without a schedule the tables grow
 * without bound (abandoned grants, burned codes, used reset links, stale
 * rate-limit windows). Cadences are generous on purpose: the tightest live
 * state these tables carry is the 30-minute verification freshness gate, and
 * every sweeper below keeps a full day of grace around anything younger.
 */

const crons = cronJobs();
crons.daily("lists-access-and-receipts",{hourUTC:4,minuteUTC:5},internal.lists.access.sweep,{});

crons.daily(
  "delete-expired-sessions",
  { hourUTC: 4, minuteUTC: 10 },
  internal.auth.sessionStore.deleteExpired,
  {},
);

// Dead claim grants (15-minute TTL): sweep nightly.
crons.daily(
  "delete-expired-claim-grants",
  { hourUTC: 4, minuteUTC: 0 },
  internal.auth.claimGrants.deleteExpired,
  {},
);

// Verification rows dead for over a day (codes live 10 minutes; redeemed
// rows stay meaningful for 30 minutes for the registration gate).
crons.daily(
  "delete-expired-verification-codes",
  { hourUTC: 4, minuteUTC: 15 },
  internal.auth.verificationInternal.deleteExpired,
  {},
);

// Used or expired reset links (single-use, 1-hour TTL).
crons.daily(
  "delete-expired-reset-tokens",
  { hourUTC: 4, minuteUTC: 30 },
  internal.auth.passwordResetInternal.deleteExpired,
  {},
);

// Stale fixed-window counters older than a week.
crons.weekly(
  "sweep-rate-limits",
  { hourUTC: 4, minuteUTC: 45, dayOfWeek: "sunday" },
  internal.auth.rateLimit.sweepRateLimits,
  { olderThanMs: 7 * 24 * 60 * 60 * 1000 },
);

export default crons;
