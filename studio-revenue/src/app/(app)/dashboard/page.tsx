import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  sumRevenue,
  filterByDate,
  getToday,
  getDaysAgo,
  formatCurrency,
  percentChange,
  getPlatformMetrics,
} from "@/lib/calculations";
import { generateInsights } from "@/lib/insights";
import type { BookingEntry, PayoutModel } from "@/types";
import { TrendingUp, TrendingDown, Minus, Sparkles, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Fetch data in parallel
  const [entriesRes, modelsRes, studioRes] = await Promise.all([
    supabase
      .from("booking_entries")
      .select("*")
      .eq("studio_id", profile.studio_id)
      .order("date", { ascending: false }),
    supabase
      .from("payout_models")
      .select("*")
      .eq("studio_id", profile.studio_id),
    supabase
      .from("studios")
      .select("currency, monthly_revenue_goal")
      .eq("id", profile.studio_id)
      .single(),
  ]);

  const entries: BookingEntry[] = entriesRes.data ?? [];
  const payoutModels: PayoutModel[] = modelsRes.data ?? [];
  const currency = studioRes.data?.currency ?? "EUR";
  const monthlyGoal: number | null = studioRes.data?.monthly_revenue_goal
    ? Number(studioRes.data.monthly_revenue_goal)
    : null;

  // KPI calculations — month-based for studio payout cycles
  const today = getToday();
  const now = new Date();

  const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const thisMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const twoMonthsAgoStart = format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd");
  const twoMonthsAgoEnd = format(endOfMonth(subMonths(now, 2)), "yyyy-MM-dd");

  const thisMonthRevenue = sumRevenue(filterByDate(entries, thisMonthStart, thisMonthEnd));
  const lastMonthRevenue = sumRevenue(filterByDate(entries, lastMonthStart, lastMonthEnd));
  const twoMonthsAgoRevenue = sumRevenue(filterByDate(entries, twoMonthsAgoStart, twoMonthsAgoEnd));
  const yearStart = `${format(now, "yyyy")}-01-01`;
  const yearEnd = `${format(now, "yyyy")}-12-31`;
  const yearRevenue = sumRevenue(filterByDate(entries, yearStart, yearEnd));

  const monthChange = percentChange(thisMonthRevenue, lastMonthRevenue);
  const prevMonthChange = percentChange(lastMonthRevenue, twoMonthsAgoRevenue);

  const thisMonthLabel = format(now, "MMMM");
  const lastMonthLabel = format(subMonths(now, 1), "MMMM");

  // Revenue projection logic
  const daysElapsed = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const dailyRunRate = daysElapsed > 0 ? thisMonthRevenue / daysElapsed : 0;
  const projectedMonthEnd = dailyRunRate * daysInMonth;
  const projectionVsLastMonth = percentChange(projectedMonthEnd, lastMonthRevenue);

  // Confidence level based on how far through the month we are
  const monthProgressPct = (daysElapsed / daysInMonth) * 100;
  const confidenceLabel =
    monthProgressPct < 30
      ? "Early estimate"
      : monthProgressPct < 65
      ? "Moderate confidence"
      : "High confidence";

  // Goal progress
  const goalProgressPct = monthlyGoal && monthlyGoal > 0
    ? Math.min((thisMonthRevenue / monthlyGoal) * 100, 100)
    : null;
  const projectedGoalPct = monthlyGoal && monthlyGoal > 0
    ? Math.min((projectedMonthEnd / monthlyGoal) * 100, 150)
    : null;

  // Platform metrics (all entries, not just last 30 days)
  const thirtyDaysAgo = getDaysAgo(29);
  const last30Entries = filterByDate(entries, thirtyDaysAgo, today);
  // Use last 90 days for platform metrics to capture monthly payouts
  const ninetyDaysAgo = getDaysAgo(89);
  const recentEntries90 = filterByDate(entries, ninetyDaysAgo, today);
  const platformMetrics = getPlatformMetrics(recentEntries90);

  // Find min/max revenue per booking
  const rpbValues = platformMetrics
    .filter((p) => p.paidBookings > 0)
    .map((p) => p.revenuePerPaidBooking);
  const minRpb = rpbValues.length > 0 ? Math.min(...rpbValues) : 0;
  const maxRpb = rpbValues.length > 0 ? Math.max(...rpbValues) : 0;

  // Insights
  const insights = generateInsights(entries, payoutModels);

  // Recent entries
  const recentEntries = entries.slice(0, 10);

  const kpis = [
    {
      label: `${thisMonthLabel} Revenue`,
      value: thisMonthRevenue,
      change: monthChange,
      sublabel: `vs ${lastMonthLabel}`,
      badge: "Estimated",
    },
    {
      label: `${lastMonthLabel} Revenue`,
      value: lastMonthRevenue,
      change: prevMonthChange,
      sublabel: "vs prior month",
      badge: null,
    },
    {
      label: `${format(now, "yyyy")} Revenue`,
      value: yearRevenue,
      change: null,
      sublabel: "",
      badge: null,
    },
  ];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
        Overview
      </p>
      <h1 className="text-3xl font-bold text-[#113069] mt-1">Dashboard</h1>
      <p className="text-[#445D99] mt-1 mb-10">
        Your estimated revenue at a glance.
      </p>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] text-center">
          <p className="text-lg font-semibold text-[#113069]">
            No bookings yet
          </p>
          <p className="text-[#445D99] mt-2 mb-6">
            Add your first booking to start tracking revenue.
          </p>
          <a
            href="/data-input"
            className="inline-flex px-6 py-2.5 bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white text-sm font-medium rounded-lg"
          >
            Add your first booking
          </a>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Revenue Projection Hero Card */}
          <div className="bg-gradient-to-br from-[#113069] to-[#0A1E42] rounded-xl p-8 shadow-[0px_20px_40px_rgba(17,48,105,0.12)] text-white">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#98B1F2]">
                  {thisMonthLabel} Projection
                </p>
                {thisMonthRevenue > 0 ? (
                  <>
                    <p className="text-[2.75rem] font-bold leading-tight mt-1">
                      {formatCurrency(projectedMonthEnd, currency)}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-[#98B1F2]">
                        Based on {daysElapsed} of {daysInMonth} days — {confidenceLabel.toLowerCase()}
                      </span>
                      {projectionVsLastMonth !== null && (
                        <span
                          className={`flex items-center gap-1 text-sm font-medium ${
                            projectionVsLastMonth > 0
                              ? "text-emerald-400"
                              : projectionVsLastMonth < 0
                              ? "text-red-400"
                              : "text-white/60"
                          }`}
                        >
                          {projectionVsLastMonth > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : projectionVsLastMonth < 0 ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          {projectionVsLastMonth > 0 ? "+" : ""}
                          {projectionVsLastMonth.toFixed(1)}% vs {lastMonthLabel}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[2.75rem] font-bold leading-tight mt-1">
                      —
                    </p>
                    <p className="text-sm text-[#98B1F2] mt-2">
                      No {thisMonthLabel} bookings yet.{" "}
                      {lastMonthRevenue > 0 && (
                        <span>
                          Last month: {formatCurrency(lastMonthRevenue, currency)}
                        </span>
                      )}
                    </p>
                    <a
                      href="/data-input"
                      className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[#98B1F2] hover:text-white transition-colors"
                    >
                      Add {thisMonthLabel} bookings to see your projection →
                    </a>
                  </>
                )}
              </div>
              {monthlyGoal && monthlyGoal > 0 && (
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-[#98B1F2]">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-[0.05em]">
                      Monthly Goal
                    </span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(monthlyGoal, currency)}
                  </p>
                  {goalProgressPct !== null && (
                    <p className="text-sm text-[#98B1F2] mt-0.5">
                      {goalProgressPct.toFixed(0)}% reached
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Progress bar */}
            {monthlyGoal && monthlyGoal > 0 && goalProgressPct !== null && projectedGoalPct !== null ? (
              <div>
                <div className="flex justify-between text-xs text-[#98B1F2] mb-2">
                  <span>
                    {formatCurrency(thisMonthRevenue, currency)} earned so far
                  </span>
                  <span>
                    {thisMonthRevenue > 0
                      ? projectedGoalPct >= 100
                        ? "On track to hit goal"
                        : `Projected ${projectedGoalPct.toFixed(0)}% of goal`
                      : "Waiting for data"}
                  </span>
                </div>
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                  {/* Projected (ghost bar) */}
                  {thisMonthRevenue > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-white/15 rounded-full transition-all"
                      style={{ width: `${Math.min(projectedGoalPct, 100)}%` }}
                    />
                  )}
                  {/* Actual progress */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      goalProgressPct >= 100
                        ? "bg-emerald-400"
                        : "bg-[#004CED]"
                    }`}
                    style={{ width: `${goalProgressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-xs text-[#98B1F2] mb-2">
                  <span>
                    {formatCurrency(thisMonthRevenue, currency)} earned so far
                  </span>
                  {thisMonthRevenue > 0 && (
                    <span>
                      {formatCurrency(dailyRunRate, currency)}/day run rate
                    </span>
                  )}
                </div>
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#004CED] rounded-full transition-all"
                    style={{ width: `${thisMonthRevenue > 0 ? monthProgressPct : 0}%` }}
                  />
                </div>
                {!monthlyGoal && (
                  <p className="text-xs text-[#98B1F2]/60 mt-2">
                    <a href="/settings" className="underline hover:text-[#98B1F2]">
                      Set a monthly revenue goal
                    </a>{" "}
                    to track progress here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]"
              >
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  {kpi.label}
                </p>
                <p className="text-[2.75rem] font-bold text-[#113069] mt-1 leading-tight">
                  {formatCurrency(kpi.value, currency)}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {kpi.badge && (
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DDE1FF] text-[#445D99]">
                      {kpi.badge}
                    </span>
                  )}
                  {kpi.change !== null && (
                    <span
                      className={`flex items-center gap-0.5 text-sm font-medium ${
                        kpi.change > 0
                          ? "text-green-600"
                          : kpi.change < 0
                          ? "text-[#9E3F4E]"
                          : "text-[#445D99]"
                      }`}
                    >
                      {kpi.change > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : kpi.change < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      {Math.abs(kpi.change).toFixed(1)}% {kpi.sublabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Platform Performance + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Platform Table */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
              <h2 className="text-lg font-bold text-[#113069] mb-1">
                Platform Performance
              </h2>
              <p className="text-sm text-[#445D99] mb-5">Last 90 days</p>

              {platformMetrics.length === 0 ? (
                <p className="text-sm text-[#445D99] py-4">
                  No booking data for this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                        <th className="text-left px-3 py-2">Platform</th>
                        <th className="text-right px-3 py-2">Bookings</th>
                        <th className="text-right px-3 py-2">Paid</th>
                        <th className="text-right px-3 py-2">Est. Revenue</th>
                        <th className="text-right px-3 py-2">Rev/Paid</th>
                        <th className="text-right px-3 py-2">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformMetrics.map((p, idx) => (
                        <tr
                          key={p.platform}
                          className={
                            idx % 2 === 0 ? "bg-[#FAF8FF]" : "bg-white"
                          }
                        >
                          <td className="px-3 py-3 font-medium text-[#113069]">
                            {p.platform}
                          </td>
                          <td className="px-3 py-3 text-right text-[#113069]">
                            {p.bookings}
                          </td>
                          <td className="px-3 py-3 text-right text-[#445D99]">
                            {p.paidBookings !== p.bookings ? (
                              <span>
                                {p.paidBookings}{" "}
                                <span className="text-[10px] text-[#445D99]/60">
                                  ({(p.paidRatio * 100).toFixed(0)}%)
                                </span>
                              </span>
                            ) : (
                              p.paidBookings
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-[#113069]">
                            {formatCurrency(p.estimatedRevenue, currency)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-medium ${
                              p.revenuePerPaidBooking === minRpb &&
                              rpbValues.length > 1
                                ? "text-amber-600"
                                : p.revenuePerPaidBooking === maxRpb &&
                                  rpbValues.length > 1
                                ? "text-green-600"
                                : "text-[#113069]"
                            }`}
                          >
                            {formatCurrency(p.revenuePerPaidBooking, currency)}
                          </td>
                          <td className="px-3 py-3 text-right text-[#445D99]">
                            {p.revenueSharePct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Insights Card */}
            <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[#004CED]" />
                <h2 className="text-lg font-bold text-[#113069]">Insights</h2>
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DDE1FF] text-[#445D99]">
                  Beta
                </span>
              </div>
              {insights.length === 0 ? (
                <p className="text-sm text-[#445D99]">
                  Add more booking data to unlock insights about your revenue
                  patterns.
                </p>
              ) : (
                <ul className="space-y-3">
                  {insights.map((insight, i) => (
                    <li
                      key={i}
                      className="text-sm text-[#113069] leading-relaxed"
                    >
                      {insight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent Entries */}
          <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
            <h2 className="text-lg font-bold text-[#113069] mb-5">
              Recent Entries
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Platform</th>
                    <th className="text-right px-3 py-2">Bookings</th>
                    <th className="text-right px-3 py-2">Est. Revenue</th>
                    <th className="text-left px-3 py-2">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={idx % 2 === 0 ? "bg-[#FAF8FF]" : "bg-white"}
                    >
                      <td className="px-3 py-3 text-[#113069]">
                        {new Date(entry.date).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3 text-[#113069]">
                        {entry.platform}
                      </td>
                      <td className="px-3 py-3 text-right text-[#113069]">
                        {entry.bookings}
                      </td>
                      <td className="px-3 py-3 text-right text-[#113069]">
                        {formatCurrency(Number(entry.estimated_revenue), currency)}
                      </td>
                      <td className="px-3 py-3 text-[#445D99]">
                        {entry.class_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
