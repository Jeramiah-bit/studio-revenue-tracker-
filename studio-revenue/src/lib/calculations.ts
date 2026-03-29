import type { BookingEntry } from "@/types";
import { format, subDays, startOfDay } from "date-fns";

export function sumRevenue(entries: BookingEntry[]): number {
  return entries.reduce((sum, e) => sum + Number(e.estimated_revenue), 0);
}

export function sumBookings(entries: BookingEntry[]): number {
  return entries.reduce((sum, e) => sum + e.bookings, 0);
}

export function sumPaidBookings(entries: BookingEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.paid_bookings ?? e.bookings), 0);
}

export function revenuePerBooking(entries: BookingEntry[]): number {
  const totalBookings = sumBookings(entries);
  if (totalBookings === 0) return 0;
  return sumRevenue(entries) / totalBookings;
}

export function filterByDate(
  entries: BookingEntry[],
  from: string,
  to: string
): BookingEntry[] {
  return entries.filter((e) => e.date >= from && e.date <= to);
}

export function filterByPlatform(
  entries: BookingEntry[],
  platform: string
): BookingEntry[] {
  return entries.filter((e) => e.platform === platform);
}

export function getToday(): string {
  return format(startOfDay(new Date()), "yyyy-MM-dd");
}

export function getYesterday(): string {
  return format(subDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
}

export function getDaysAgo(days: number): string {
  return format(subDays(startOfDay(new Date()), days), "yyyy-MM-dd");
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  const symbols: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    CHF: "CHF ",
  };
  const symbol = symbols[currency] ?? "€";
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface PlatformMetrics {
  platform: string;
  bookings: number;
  paidBookings: number;
  paidRatio: number;
  estimatedRevenue: number;
  revenuePerBooking: number;
  revenuePerPaidBooking: number;
  revenueSharePct: number;
}

export function getPlatformMetrics(entries: BookingEntry[]): PlatformMetrics[] {
  const totalRevenue = sumRevenue(entries);
  const platforms = [...new Set(entries.map((e) => e.platform))];

  return platforms
    .map((platform) => {
      const platformEntries = filterByPlatform(entries, platform);
      const bookings = sumBookings(platformEntries);
      const paidBookings = sumPaidBookings(platformEntries);
      const estimatedRevenue = sumRevenue(platformEntries);
      return {
        platform,
        bookings,
        paidBookings,
        paidRatio: bookings > 0 ? paidBookings / bookings : 1,
        estimatedRevenue,
        revenuePerBooking: bookings > 0 ? estimatedRevenue / bookings : 0,
        revenuePerPaidBooking: paidBookings > 0 ? estimatedRevenue / paidBookings : 0,
        revenueSharePct: totalRevenue > 0 ? (estimatedRevenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
}
