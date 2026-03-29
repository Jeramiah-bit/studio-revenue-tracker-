import type { BookingEntry, PayoutModel } from "@/types";
import {
  sumRevenue,
  sumBookings,
  filterByDate,
  filterByPlatform,
  getToday,
  getYesterday,
  getDaysAgo,
  getPlatformMetrics,
} from "./calculations";

/** Generate up to 3 rule-based insights, prioritised by impact magnitude. */
export function generateInsights(
  entries: BookingEntry[],
  payoutModels: PayoutModel[],
  _period?: { from: Date; to: Date }
): string[] {
  if (entries.length === 0) return [];

  const today = getToday();
  const yesterday = getYesterday();
  const sevenDaysAgo = getDaysAgo(6);
  const fourteenDaysAgo = getDaysAgo(13);

  // Use all entries for metrics (monthly payout data won't fall in 7-day window)
  const metrics = getPlatformMetrics(entries);

  const scored: { text: string; impact: number }[] = [];

  // Rule 1: Lowest yield platform
  lowestYield(metrics, scored);

  // Rule 2: Yield gap vs direct
  yieldGapVsDirect(metrics, scored);

  // Rule 3: Revenue share concentration
  revenueConcentration(metrics, scored);

  // Rule 4: Day-over-day change
  dayOverDay(entries, today, yesterday, scored);

  // Rule 5: Week-over-week (14+ days of data)
  weekOverWeek(entries, today, sevenDaysAgo, fourteenDaysAgo, scored);

  // Rule 6: Bookings with no payout model
  missingPayoutModel(entries, payoutModels, scored);

  // Rule 7: Low paid booking ratio (first-timer heavy platforms)
  lowPaidRatio(metrics, scored);

  // Rule 8: Busiest platform (always fires with 1+ entries)
  busiestPlatform(metrics, scored);

  // Rule 9: Revenue per booking summary (always fires with 1+ entries)
  revenuePerBookingSummary(entries, metrics, scored);

  // Sort by impact descending, return top 3
  scored.sort((a, b) => b.impact - a.impact);
  return scored.slice(0, 3).map((s) => s.text);
}

/** Rule 1: Lowest yield platform (based on revenue per paid booking) */
function lowestYield(
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  const withBookings = metrics.filter((m) => m.paidBookings > 0);
  if (withBookings.length < 2) return;

  const sorted = [...withBookings].sort(
    (a, b) => a.revenuePerPaidBooking - b.revenuePerPaidBooking
  );
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  const gapPct =
    ((highest.revenuePerPaidBooking - lowest.revenuePerPaidBooking) /
      highest.revenuePerPaidBooking) *
    100;

  if (gapPct > 30) {
    scored.push({
      text: `${lowest.platform} has the lowest revenue per paid booking at €${lowest.revenuePerPaidBooking.toFixed(2)} — ${gapPct.toFixed(1)}% below your best channel`,
      impact: gapPct,
    });
  }
}

/** Rule 2: Yield gap vs direct bookings */
function yieldGapVsDirect(
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  const direct = metrics.find(
    (m) => m.platform === "Direct / Eversports" && m.bookings > 0
  );
  if (!direct) return;

  for (const m of metrics) {
    if (m.platform === "Direct / Eversports" || m.bookings === 0) continue;
    const gap = direct.revenuePerBooking - m.revenuePerBooking;
    if (gap > 0) {
      scored.push({
        text: `Switching one ${m.platform} booking to direct would earn you €${gap.toFixed(2)} more per spot`,
        impact: gap * m.bookings,
      });
    }
  }
}

/** Rule 3: Revenue share concentration */
function revenueConcentration(
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  for (const m of metrics) {
    if (m.revenueSharePct > 60) {
      scored.push({
        text: `${m.platform} drives ${m.revenueSharePct.toFixed(1)}% of your estimated revenue — high dependency on one channel`,
        impact: m.revenueSharePct,
      });
    }
  }
}

/** Rule 4: Day-over-day change */
function dayOverDay(
  entries: BookingEntry[],
  today: string,
  yesterday: string,
  scored: { text: string; impact: number }[]
) {
  const todayRev = sumRevenue(filterByDate(entries, today, today));
  const yesterdayRev = sumRevenue(filterByDate(entries, yesterday, yesterday));

  if (yesterdayRev === 0 && todayRev === 0) return;
  if (yesterdayRev === 0) return;

  const changePct = ((todayRev - yesterdayRev) / yesterdayRev) * 100;
  const direction = changePct >= 0 ? "up" : "down";

  scored.push({
    text: `Revenue is ${direction} ${Math.abs(changePct).toFixed(1)}% vs yesterday (€${yesterdayRev.toFixed(2)} → €${todayRev.toFixed(2)})`,
    impact: Math.abs(changePct),
  });
}

/** Rule 5: Week-over-week comparison */
function weekOverWeek(
  entries: BookingEntry[],
  today: string,
  sevenDaysAgo: string,
  fourteenDaysAgo: string,
  scored: { text: string; impact: number }[]
) {
  // Only show if 14+ days of data
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  if (dates.length < 14) return;

  const thisWeek = sumRevenue(filterByDate(entries, sevenDaysAgo, today));
  const lastWeek = sumRevenue(
    filterByDate(entries, fourteenDaysAgo, getDaysAgo(7))
  );

  if (lastWeek === 0) return;

  const changePct = ((thisWeek - lastWeek) / lastWeek) * 100;
  const direction = changePct >= 0 ? "above" : "below";

  scored.push({
    text: `This week is tracking ${Math.abs(changePct).toFixed(1)}% ${direction} last week`,
    impact: Math.abs(changePct) * 0.8, // slightly lower priority than day-over-day
  });
}

/** Rule 6: Bookings with no payout model */
function missingPayoutModel(
  entries: BookingEntry[],
  payoutModels: PayoutModel[],
  scored: { text: string; impact: number }[]
) {
  const modelPlatforms = new Set(payoutModels.map((m) => m.platform));
  const entryPlatforms = [...new Set(entries.map((e) => e.platform))];

  for (const platform of entryPlatforms) {
    if (!modelPlatforms.has(platform)) {
      const count = entries.filter((e) => e.platform === platform).length;
      scored.push({
        text: `${platform} has ${count} bookings with no payout model configured — add one in Settings`,
        impact: 100, // high priority
      });
    }
  }
}

/** Rule 7: Low paid booking ratio — first-timer heavy platforms */
function lowPaidRatio(
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  for (const m of metrics) {
    if (m.bookings === 0 || m.paidBookings === m.bookings) continue;

    const paidPct = m.paidRatio * 100;
    const unpaidCount = m.bookings - m.paidBookings;
    const effectiveYield = m.revenuePerBooking;

    if (paidPct < 60) {
      scored.push({
        text: `Only ${paidPct.toFixed(0)}% of ${m.platform} bookings generate revenue (${unpaidCount} unpaid) — your effective yield per total booking is just €${effectiveYield.toFixed(2)}`,
        impact: (100 - paidPct) * 0.9,
      });
    }
  }
}

/** Rule 8: Busiest platform — always fires with data */
function busiestPlatform(
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  if (metrics.length === 0) return;

  const busiest = metrics.reduce((a, b) =>
    a.bookings > b.bookings ? a : b
  );

  const totalBookings = metrics.reduce((s, m) => s + m.bookings, 0);

  if (metrics.length === 1) {
    scored.push({
      text: `${busiest.platform} is your only active channel with ${busiest.bookings} bookings — consider diversifying across platforms to reduce dependency`,
      impact: 15,
    });
  } else {
    const pct = ((busiest.bookings / totalBookings) * 100).toFixed(0);
    scored.push({
      text: `${busiest.platform} is your highest-volume platform with ${busiest.bookings} bookings (${pct}% of total)`,
      impact: 10,
    });
  }
}

/** Rule 9: Average revenue per booking across all platforms */
function revenuePerBookingSummary(
  entries: BookingEntry[],
  metrics: ReturnType<typeof getPlatformMetrics>,
  scored: { text: string; impact: number }[]
) {
  if (metrics.length === 0) return;

  const totalRevenue = metrics.reduce((s, m) => s + m.estimatedRevenue, 0);
  const totalPaid = metrics.reduce((s, m) => s + m.paidBookings, 0);

  if (totalPaid === 0) return;

  const avgPerBooking = totalRevenue / totalPaid;

  // Count unique months of data
  const months = new Set(entries.map((e) => e.date.substring(0, 7)));

  scored.push({
    text: `Your blended revenue per paid booking is €${avgPerBooking.toFixed(2)} across ${months.size} month${months.size !== 1 ? "s" : ""} of data`,
    impact: 8,
  });
}
