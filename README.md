# StudioRevenue

> **Find out which platform is costing you money — and fix it.**

A lightweight financial operations tool for boutique fitness studio owners. StudioRevenue gives you a single daily revenue view across Eversports, ClassPass, Urban Sports Club, WellPass, and any other booking platform — so you can stop guessing and start making better decisions about your platform mix.

---

## The Problem

Boutique fitness studios running multiple booking platforms face five financial blind spots:

1. **Payout lag and opacity** — ClassPass and Urban Sports pay monthly, often with 30–60 day delays. Payout reports are hard to reconcile and rarely explain variances.
2. **Platform cannibalization** — Are ClassPass members displacing direct bookings at lower yield? No current tool answers this.
3. **Cash flow unpredictability** — Lagged, lumpy payouts make it nearly impossible to forecast next month's cash position.
4. **Price-per-class confusion** — A class on ClassPass might yield €4. The same class direct yields €18. Most operators can't see this comparison in real time.
5. **No-show economics** — Platforms handle no-shows differently. Some pay, some don't. This is invisible in current tooling.

## What It Does

StudioRevenue solves this by letting operators:

- Input daily booking counts by platform
- Define average payout assumptions per platform
- See estimated daily / weekly revenue instantly
- Compare platforms by yield per booking — not just volume
- Track expected vs actual cash arrival dates
- Compare estimated vs actual monthly payouts
- Get plain-language insights about which platforms are underperforming

> All revenue figures are **estimates**, not accounting-grade actuals.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Database + Auth | Supabase |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Charts | Recharts |
| Date handling | date-fns |
| CSV parsing | PapaParse |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- A Vercel account (for deployment)

### Installation

```bash
git clone https://github.com/your-org/studio-revenue.git
cd studio-revenue
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Studios
create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text default 'EUR',
  timezone text,
  week_start text,
  created_at timestamp default now()
);

-- Booking entries
create table booking_entries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id),
  date date not null,
  platform text not null,
  bookings integer not null check (bookings >= 0),
  class_name text,
  trainer_name text,
  estimated_revenue numeric,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Payout models
create table payout_models (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id),
  platform text not null,
  avg_payout_per_booking numeric not null,
  updated_at timestamp default now()
);

-- Actual payouts (for reconciliation)
create table actual_payouts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id),
  month text not null,
  platform text not null,
  actual_payout_total numeric not null,
  created_at timestamp default now()
);

-- Profiles
create table profiles (
  id uuid primary key,
  studio_id uuid references studios(id),
  email text,
  created_at timestamp default now()
);
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Pages

| Page | Path | Description |
|---|---|---|
| Dashboard | `/dashboard` | KPI cards, platform yield table, insights |
| Data Input | `/data-input` | Manual entry form + CSV upload |
| Data | `/data` | Full entries table with edit/delete |
| Reconciliation | `/reconciliation` | Estimated vs actual monthly comparison + variance |
| Platform Intelligence | `/platforms` | Yield per booking, revenue share, cannibalization view *(V1.1)* |
| Settings | `/settings` | Studio profile + payout model config + payout lag settings |

---

## Core Calculations

```
// Revenue
estimated_revenue = bookings x avg_payout_per_booking
revenue_per_booking = estimated_revenue / total_bookings

// Reconciliation
variance_eur = actual_payout_total - estimated_revenue
variance_pct = variance_eur / estimated_revenue x 100

// Platform yield comparison
yield_gap = direct_revenue_per_booking - platform_revenue_per_booking
revenue_share_pct = platform_estimated_revenue / total_estimated_revenue x 100

// Cash flow forecast (V1.1+)
expected_cash_next_30d = SUM(estimated_revenue) for bookings in next 30 days
                         adjusted for each platform's known payout lag
```

---

## Folder Structure

```
/src
  /app
    /(auth)
      /login
      /signup
    /dashboard
    /data-input
    /data
    /reconciliation
    /settings
    /api
  /components
    /dashboard
    /data
    /forms
    /layout
    /reconciliation
    /settings
    /ui
  /lib
    calculations.ts
    insights.ts
    csv.ts
    /supabase
    validators.ts
  /types
```

---

## Default Platforms

- Direct / Eversports
- ClassPass
- Urban Sports Club
- WellPass
- Other (custom)

---

## Non-Goals (MVP)

- No direct API integrations with platforms
- No scraping
- No accounting-grade accuracy
- No payroll, invoicing, or bookkeeping
- No multi-tenant enterprise features
- No cash flow forecasting (V1.1+)
- No platform cannibalization analysis (V1.1+)

---

## Roadmap

### V1 — MVP (48 hours)
Core booking entry, payout models, dashboard KPIs, reconciliation, CSV import.

### V1.1 — Value Deepening
| Feature | Rationale |
|---|---|
| Platform yield comparison view | Shows €/booking gap between direct and third-party platforms |
| Payout lag tracker | Records expected vs actual cash arrival per platform |
| Cash flow forecast (30/60 day) | Based on booking trends + configurable payout lag per platform |
| "Should I accept this platform?" advisor | Rule-based recommendation from yield + volume data |
| Break-even per class | Requires instructor cost + room cost inputs |

### V2 — Growth
| Feature | Rationale |
|---|---|
| Direct vs platform ROI view | Killer retention feature — shows true cost of each platform |
| Eversports PDF payout import | Removes manual entry friction for biggest platform |
| Confidence ranges for ClassPass | ClassPass yield varies — show min/max not just avg |
| Multi-location support | Unlocks studio groups and franchises |
| Benchmark analytics | Anonymous cross-studio yield comparisons |

---

## Market Sizing (Europe)

| Segment | Estimate |
|---|---|
| Boutique fitness studios in Europe | 50,000–80,000 |
| Addressable (€5k–€100k/mo revenue) | ~20,000–30,000 |
| Target price point | €49–€99/month |
| Realistic TAM (Europe) | €12M–€35M ARR |
| Early MRR target (6 months) | €2.5k–€5k (50–100 studios) |

---

## Deployment

```bash
vercel deploy
```

Set environment variables in your Vercel project dashboard before deploying.

---

## License

Internal use only — MVP phase.
