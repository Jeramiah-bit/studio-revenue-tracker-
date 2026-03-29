# Prompt 01 — Supabase Schema + TypeScript Types

Paste this into Claude or Codex.

---

## Prompt

Create the Supabase SQL schema and matching TypeScript types for a web app called StudioRevenue.

### Database tables required

**studios**
- id: uuid, primary key, default gen_random_uuid()
- name: text, not null
- currency: text, default 'EUR'
- timezone: text
- week_start: text
- created_at: timestamp, default now()

**profiles**
- id: uuid, primary key (matches Supabase auth user id)
- studio_id: uuid, foreign key → studios(id)
- email: text
- created_at: timestamp, default now()

**payout_models**
- id: uuid, primary key, default gen_random_uuid()
- studio_id: uuid, foreign key → studios(id)
- platform: text, not null
- avg_payout_per_booking: numeric, not null
- payout_lag_days: integer, nullable
- updated_at: timestamp, default now()

**booking_entries**
- id: uuid, primary key, default gen_random_uuid()
- studio_id: uuid, foreign key → studios(id)
- date: date, not null
- platform: text, not null
- bookings: integer, not null, check >= 0
- class_name: text, nullable
- trainer_name: text, nullable
- estimated_revenue: numeric (computed: bookings * avg_payout_per_booking, stored on save)
- created_at: timestamp, default now()
- updated_at: timestamp, default now()

**actual_payouts**
- id: uuid, primary key, default gen_random_uuid()
- studio_id: uuid, foreign key → studios(id)
- month: text, not null (format: "YYYY-MM")
- platform: text, not null
- actual_payout_total: numeric, not null
- created_at: timestamp, default now()

### Row Level Security
Enable RLS on all tables. Each table should have a policy that allows authenticated users to only read/write rows where studio_id matches their own studio (via profiles table).

### TypeScript types
Generate a file at `/src/types/index.ts` with full TypeScript interfaces matching every table. Use exact column names. Include a `Database` type compatible with Supabase's generated types pattern.

### Output
1. SQL file with all CREATE TABLE statements and RLS policies
2. `/src/types/index.ts` with all TypeScript interfaces

Return TypeScript and SQL only. No explanation needed.
