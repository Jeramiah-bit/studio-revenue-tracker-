import { z } from "zod";

export const payoutModelSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  avg_payout_per_booking: z.number().min(0, "Must be 0 or more"),
  payout_lag_days: z.number().int().min(0).optional(),
});

export type PayoutModelFormValues = z.infer<typeof payoutModelSchema>;

export const studioSettingsSchema = z.object({
  name: z.string().min(1, "Studio name is required"),
  currency: z.string().min(1),
  timezone: z.string().optional(),
  week_start: z.string().optional(),
  monthly_revenue_goal: z.number().min(0).optional(),
});

export type StudioSettingsFormValues = z.infer<typeof studioSettingsSchema>;

export const bookingEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  platform: z.string().min(1, "Platform is required"),
  bookings: z.number().int("Must be a whole number").min(0, "Must be 0 or more"),
  paid_bookings: z.number().int("Must be a whole number").min(0).optional(),
  class_name: z.string().optional(),
  trainer_name: z.string().optional(),
});

export type BookingEntryFormValues = z.infer<typeof bookingEntrySchema>;

export const actualPayoutSchema = z.object({
  month: z.string().min(1, "Month is required"),
  platform: z.string().min(1, "Platform is required"),
  actual_payout_total: z.number().min(0, "Must be 0 or more"),
});

export type ActualPayoutFormValues = z.infer<typeof actualPayoutSchema>;
