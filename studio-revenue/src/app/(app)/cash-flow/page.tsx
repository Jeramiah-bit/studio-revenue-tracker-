"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import type { BookingEntry, PayoutModel, ActualPayout } from "@/types";
import { toast } from "sonner";
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInDays,
  isBefore,
  parseISO,
} from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExpectedPayout {
  platform: string;
  month: string;
  estimatedAmount: number;
  expectedDate: string;
  status: "pending" | "received" | "late";
  lagDays: number;
  actualAmount?: number;
}

export default function CashFlowPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<BookingEntry[]>([]);
  const [payoutModels, setPayoutModels] = useState<PayoutModel[]>([]);
  const [actualPayouts, setActualPayouts] = useState<ActualPayout[]>([]);
  const [currency, setCurrency] = useState("EUR");
  const [studioId, setStudioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // "Mark as received" inline confirm state
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<string>("");

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setStudioId(profile.studio_id);

    const [entriesRes, modelsRes, payoutsRes, studioRes] = await Promise.all([
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
        .from("actual_payouts")
        .select("*")
        .eq("studio_id", profile.studio_id),
      supabase
        .from("studios")
        .select("currency")
        .eq("id", profile.studio_id)
        .single(),
    ]);

    setEntries(entriesRes.data ?? []);
    setPayoutModels(modelsRes.data ?? []);
    setActualPayouts(payoutsRes.data ?? []);
    setCurrency(studioRes.data?.currency ?? "EUR");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Build expected payouts
  const expectedPayouts: ExpectedPayout[] = [];

  for (let i = 0; i < 4; i++) {
    const serviceMonth = subMonths(today, i);
    const serviceMonthStr = format(serviceMonth, "yyyy-MM");
    const monthStart = format(startOfMonth(serviceMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(serviceMonth), "yyyy-MM-dd");

    for (const model of payoutModels) {
      const lagDays = model.payout_lag_days ?? 30;

      const monthEntries = entries.filter(
        (e) =>
          e.platform === model.platform &&
          e.date >= monthStart &&
          e.date <= monthEnd
      );

      if (monthEntries.length === 0) continue;

      const estimatedAmount = monthEntries.reduce(
        (sum, e) => sum + Number(e.estimated_revenue),
        0
      );

      const monthEndDate = endOfMonth(serviceMonth);
      const expectedDate = addDays(monthEndDate, lagDays);
      const expectedDateStr = format(expectedDate, "yyyy-MM-dd");

      const actual = actualPayouts.find(
        (p) => p.platform === model.platform && p.month === serviceMonthStr
      );

      let status: ExpectedPayout["status"] = "pending";
      if (actual) {
        status = "received";
      } else if (isBefore(expectedDate, today)) {
        status = "late";
      }

      expectedPayouts.push({
        platform: model.platform,
        month: serviceMonthStr,
        estimatedAmount,
        expectedDate: expectedDateStr,
        status,
        lagDays,
        actualAmount: actual ? Number(actual.actual_payout_total) : undefined,
      });
    }
  }

  const sortedPayouts = [...expectedPayouts].sort((a, b) =>
    a.expectedDate.localeCompare(b.expectedDate)
  );

  const sixtyDaysOut = format(addDays(today, 60), "yyyy-MM-dd");
  const upcomingPayouts = sortedPayouts.filter(
    (p) =>
      p.status !== "received" &&
      p.expectedDate >= todayStr &&
      p.expectedDate <= sixtyDaysOut
  );
  const latePayouts = sortedPayouts.filter((p) => p.status === "late");
  const receivedPayouts = sortedPayouts.filter((p) => p.status === "received");

  // Gap detection
  const pendingDates = upcomingPayouts.map((p) => parseISO(p.expectedDate));
  let gapAlert: {
    startDate: string;
    endDate: string;
    days: number;
    nextPayout: ExpectedPayout | null;
  } | null = null;

  if (pendingDates.length === 0 && entries.length > 0) {
    gapAlert = {
      startDate: todayStr,
      endDate: sixtyDaysOut,
      days: 60,
      nextPayout: null,
    };
  } else if (pendingDates.length > 0) {
    const firstPayoutDate = pendingDates[0];
    const daysToFirst = differenceInDays(firstPayoutDate, today);
    if (daysToFirst > 14) {
      gapAlert = {
        startDate: todayStr,
        endDate: format(firstPayoutDate, "yyyy-MM-dd"),
        days: daysToFirst,
        nextPayout: upcomingPayouts[0],
      };
    }
    for (let i = 0; i < pendingDates.length - 1; i++) {
      const gap = differenceInDays(pendingDates[i + 1], pendingDates[i]);
      if (gap > 14 && (!gapAlert || gap > gapAlert.days)) {
        gapAlert = {
          startDate: format(pendingDates[i], "yyyy-MM-dd"),
          endDate: format(pendingDates[i + 1], "yyyy-MM-dd"),
          days: gap,
          nextPayout: upcomingPayouts[i + 1],
        };
      }
    }
  }

  const totalUpcoming = upcomingPayouts.reduce(
    (s, p) => s + p.estimatedAmount,
    0
  );
  const totalLate = latePayouts.reduce((s, p) => s + p.estimatedAmount, 0);
  const totalReceived = receivedPayouts.reduce(
    (s, p) => s + (p.actualAmount ?? p.estimatedAmount),
    0
  );

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-[#445D99]",
      bg: "bg-[#F2F3FF]",
      label: "Pending",
    },
    received: {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      label: "Received",
    },
    late: {
      icon: AlertTriangle,
      color: "text-[#9E3F4E]",
      bg: "bg-red-50",
      label: "Late",
    },
  };

  const hasData = entries.length > 0 && payoutModels.length > 0;
  const hasLagConfig = payoutModels.some((m) => m.payout_lag_days !== null);

  function startConfirm(payout: ExpectedPayout) {
    const key = `${payout.platform}-${payout.month}`;
    setConfirmingKey(key);
    setConfirmAmount(payout.estimatedAmount.toFixed(2));
  }

  function cancelConfirm() {
    setConfirmingKey(null);
    setConfirmAmount("");
  }

  async function confirmReceived(payout: ExpectedPayout) {
    if (!studioId) return;

    const amount = parseFloat(confirmAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const { error } = await supabase.from("actual_payouts").upsert(
      {
        studio_id: studioId,
        month: payout.month,
        platform: payout.platform,
        actual_payout_total: amount,
      },
      { onConflict: "studio_id,month,platform" }
    );

    if (error) {
      toast.error("Failed to save payout");
      return;
    }

    const variance = amount - payout.estimatedAmount;
    const variancePct =
      payout.estimatedAmount > 0
        ? ((variance / payout.estimatedAmount) * 100).toFixed(1)
        : "0";

    toast.success(
      `${payout.platform} ${format(parseISO(`${payout.month}-01`), "MMM yyyy")} marked as received — ${
        variance >= 0 ? "+" : ""
      }${variancePct}% vs estimate`
    );

    setConfirmingKey(null);
    setConfirmAmount("");
    loadData();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#F2F3FF] rounded-lg animate-pulse" />
        <div className="h-64 bg-[#F2F3FF] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
        Cash Management
      </p>
      <h1 className="text-3xl font-bold text-[#113069] mt-1">Cash Flow</h1>
      <p className="text-[#445D99] mt-1 mb-10">
        When will money actually arrive in your bank account?
      </p>

      {!hasData ? (
        <div className="bg-white rounded-xl p-12 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] text-center">
          <CalendarDays className="w-10 h-10 text-[#98B1F2] mx-auto mb-4" />
          <p className="text-lg font-semibold text-[#113069]">
            No cash flow data yet
          </p>
          <p className="text-[#445D99] mt-2 mb-6 max-w-md mx-auto">
            Add booking data and configure payout lag days per platform in{" "}
            <a href="/settings" className="text-[#004CED] font-medium">
              Settings
            </a>{" "}
            to see when your payouts will arrive.
          </p>
          <a
            href="/data-input"
            className="inline-flex px-6 py-2.5 bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white text-sm font-medium rounded-lg"
          >
            Add booking data
          </a>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Config hint */}
          {!hasLagConfig && (
            <div className="bg-[#F2F3FF] rounded-xl px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#004CED] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#113069]">
                  Payout timing not configured
                </p>
                <p className="text-sm text-[#445D99] mt-0.5">
                  Set payout lag days for each platform in{" "}
                  <a
                    href="/settings"
                    className="text-[#004CED] font-medium underline"
                  >
                    Settings
                  </a>{" "}
                  for accurate cash flow predictions. Using default of 30 days
                  after month end.
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
              <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                Expected (Next 60 Days)
              </p>
              <p className="text-[2.75rem] font-bold text-[#113069] mt-1 leading-tight">
                {formatCurrency(totalUpcoming, currency)}
              </p>
              <p className="text-sm text-[#445D99] mt-1">
                {upcomingPayouts.length} payout
                {upcomingPayouts.length !== 1 ? "s" : ""} pending
              </p>
            </div>
            {latePayouts.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] border border-[#9E3F4E]/20">
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#9E3F4E]">
                  Overdue
                </p>
                <p className="text-[2.75rem] font-bold text-[#9E3F4E] mt-1 leading-tight">
                  {formatCurrency(totalLate, currency)}
                </p>
                <p className="text-sm text-[#445D99] mt-1">
                  {latePayouts.length} payout
                  {latePayouts.length !== 1 ? "s" : ""} past expected date
                </p>
              </div>
            )}
            <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
              <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                Received (Recent)
              </p>
              <p className="text-[2.75rem] font-bold text-green-600 mt-1 leading-tight">
                {formatCurrency(totalReceived, currency)}
              </p>
              <p className="text-sm text-[#445D99] mt-1">
                {receivedPayouts.length} payout
                {receivedPayouts.length !== 1 ? "s" : ""} confirmed
              </p>
            </div>
          </div>

          {/* Gap Alert */}
          {gapAlert && gapAlert.days > 14 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#113069]">
                  Cash gap detected — {gapAlert.days} days with no expected
                  inflow
                </p>
                <p className="text-sm text-[#445D99] mt-0.5">
                  No expected payouts between{" "}
                  {format(parseISO(gapAlert.startDate), "MMM d")} and{" "}
                  {format(parseISO(gapAlert.endDate), "MMM d")}.
                  {gapAlert.nextPayout && (
                    <>
                      {" "}
                      Next inflow: ~
                      {formatCurrency(
                        gapAlert.nextPayout.estimatedAmount,
                        currency
                      )}{" "}
                      from {gapAlert.nextPayout.platform} on{" "}
                      {format(
                        parseISO(gapAlert.nextPayout.expectedDate),
                        "MMM d"
                      )}
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Upcoming & Late Payouts Table */}
          <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
            <h2 className="text-lg font-bold text-[#113069] mb-1">
              Upcoming Payouts
            </h2>
            <p className="text-sm text-[#445D99] mb-5">Next 60 days</p>

            {upcomingPayouts.length === 0 && latePayouts.length === 0 ? (
              <p className="text-sm text-[#445D99] py-4">
                No upcoming payouts expected. Add more booking data to see
                projections.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                      <th className="text-left px-4 py-2">Platform</th>
                      <th className="text-left px-4 py-2">Service Month</th>
                      <th className="text-right px-4 py-2">Est. Amount</th>
                      <th className="text-left px-4 py-2">Expected Date</th>
                      <th className="text-right px-4 py-2">Status</th>
                      <th className="text-right px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...latePayouts, ...upcomingPayouts].map((payout, idx) => {
                      const config = statusConfig[payout.status];
                      const StatusIcon = config.icon;
                      const key = `${payout.platform}-${payout.month}`;
                      const isConfirming = confirmingKey === key;

                      return (
                        <tr
                          key={key}
                          className={
                            idx % 2 === 0 ? "bg-[#FAF8FF]" : "bg-white"
                          }
                        >
                          <td className="px-4 py-3 font-medium text-[#113069]">
                            {payout.platform}
                          </td>
                          <td className="px-4 py-3 text-[#445D99]">
                            {format(
                              parseISO(`${payout.month}-01`),
                              "MMMM yyyy"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-[#113069] font-medium">
                            {formatCurrency(payout.estimatedAmount, currency)}
                          </td>
                          <td className="px-4 py-3 text-[#113069]">
                            {format(
                              parseISO(payout.expectedDate),
                              "MMM d, yyyy"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bg} ${config.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {config.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={confirmAmount}
                                  onChange={(e) =>
                                    setConfirmAmount(e.target.value)
                                  }
                                  className="w-28 h-8 text-sm bg-white border-[#98B1F2]/30"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      confirmReceived(payout);
                                    }
                                    if (e.key === "Escape") cancelConfirm();
                                  }}
                                />
                                <button
                                  onClick={() => confirmReceived(payout)}
                                  className="text-green-600 hover:text-green-700"
                                  title="Confirm"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelConfirm}
                                  className="text-[#445D99] hover:text-[#9E3F4E]"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startConfirm(payout)}
                                className="text-xs font-medium text-[#004CED] hover:bg-[#004CED] hover:text-white border border-[#004CED] rounded-md px-3 py-1.5 whitespace-nowrap transition-colors"
                              >
                                Mark received
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cash Flow Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
            <h2 className="text-lg font-bold text-[#113069] mb-1">Timeline</h2>
            <p className="text-sm text-[#445D99] mb-5">
              Expected payout schedule by platform
            </p>

            {sortedPayouts.length === 0 ? (
              <p className="text-sm text-[#445D99] py-4">
                No payout timeline data available.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPayouts.map((payout) => {
                  const config = statusConfig[payout.status];
                  const StatusIcon = config.icon;
                  const daysUntil = differenceInDays(
                    parseISO(payout.expectedDate),
                    today
                  );
                  const key = `${payout.platform}-${payout.month}-timeline`;

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#FAF8FF]"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}
                      >
                        <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#113069]">
                          {payout.platform}{" "}
                          <span className="text-[#445D99] font-normal">
                            —{" "}
                            {format(
                              parseISO(`${payout.month}-01`),
                              "MMM yyyy"
                            )}{" "}
                            earnings
                          </span>
                        </p>
                        <p className="text-xs text-[#445D99]">
                          {payout.status === "received"
                            ? `Received — ${formatCurrency(payout.actualAmount ?? payout.estimatedAmount, currency)}`
                            : payout.status === "late"
                            ? `${Math.abs(daysUntil)} days overdue`
                            : daysUntil === 0
                            ? "Expected today"
                            : `In ${daysUntil} days`}{" "}
                          —{" "}
                          {format(
                            parseISO(payout.expectedDate),
                            "MMM d, yyyy"
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[#113069]">
                        {formatCurrency(
                          payout.actualAmount ?? payout.estimatedAmount,
                          currency
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
