-- StudioRevenue Database Schema
-- Run this in the Supabase SQL Editor

-- Studios table
CREATE TABLE studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text DEFAULT 'EUR',
  timezone text,
  week_start text,
  monthly_revenue_goal numeric,
  created_at timestamptz DEFAULT now()
);

-- Profiles table (links Supabase auth users to studios)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now()
);

-- Payout models (per-platform payout configuration)
CREATE TABLE payout_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  avg_payout_per_booking numeric NOT NULL,
  payout_lag_days integer,
  updated_at timestamptz DEFAULT now()
);

-- Booking entries (daily booking data per platform)
CREATE TABLE booking_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  platform text NOT NULL,
  bookings integer NOT NULL CHECK (bookings >= 0),
  paid_bookings integer,
  class_name text,
  trainer_name text,
  estimated_revenue numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actual payouts (monthly actual payout data for reconciliation)
CREATE TABLE actual_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,
  platform text NOT NULL,
  actual_payout_total numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(studio_id, month, platform)
);

-- Enable Row Level Security on all tables
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Studios: users can access their own studio via profiles
CREATE POLICY "Users can view own studio"
  ON studios FOR SELECT
  USING (id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update own studio"
  ON studios FOR UPDATE
  USING (id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

-- Payout models: scoped to user's studio
CREATE POLICY "Users can view own payout models"
  ON payout_models FOR SELECT
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert own payout models"
  ON payout_models FOR INSERT
  WITH CHECK (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update own payout models"
  ON payout_models FOR UPDATE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete own payout models"
  ON payout_models FOR DELETE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

-- Booking entries: scoped to user's studio
CREATE POLICY "Users can view own booking entries"
  ON booking_entries FOR SELECT
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert own booking entries"
  ON booking_entries FOR INSERT
  WITH CHECK (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update own booking entries"
  ON booking_entries FOR UPDATE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete own booking entries"
  ON booking_entries FOR DELETE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

-- Actual payouts: scoped to user's studio
CREATE POLICY "Users can view own actual payouts"
  ON actual_payouts FOR SELECT
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert own actual payouts"
  ON actual_payouts FOR INSERT
  WITH CHECK (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update own actual payouts"
  ON actual_payouts FOR UPDATE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete own actual payouts"
  ON actual_payouts FOR DELETE
  USING (studio_id IN (SELECT studio_id FROM profiles WHERE profiles.id = auth.uid()));

-- Function to auto-create profile and studio on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_studio_id uuid;
BEGIN
  INSERT INTO studios (name) VALUES (COALESCE(NEW.raw_user_meta_data->>'studio_name', 'My Studio'))
  RETURNING id INTO new_studio_id;

  INSERT INTO profiles (id, studio_id, email)
  VALUES (NEW.id, new_studio_id, NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
