export interface Studio {
  id: string;
  name: string;
  currency: string;
  timezone: string | null;
  week_start: string | null;
  monthly_revenue_goal: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  studio_id: string;
  email: string;
  created_at: string;
}

export interface PayoutModel {
  id: string;
  studio_id: string;
  platform: string;
  avg_payout_per_booking: number;
  payout_lag_days: number | null;
  updated_at: string;
}

export interface BookingEntry {
  id: string;
  studio_id: string;
  date: string;
  platform: string;
  bookings: number;
  paid_bookings: number | null;
  class_name: string | null;
  trainer_name: string | null;
  estimated_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface ActualPayout {
  id: string;
  studio_id: string;
  month: string;
  platform: string;
  actual_payout_total: number;
  created_at: string;
}

export const DEFAULT_PLATFORMS = [
  "Direct / Eversports",
  "ClassPass",
  "Urban Sports Club",
  "WellPass",
  "Other",
] as const;
