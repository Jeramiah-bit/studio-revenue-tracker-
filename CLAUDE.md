# CLAUDE.md — StudioRevenue

This file gives Claude (or any AI coding assistant) the context needed to contribute effectively to this codebase.

---

## Project Summary

**StudioRevenue** is a financial operations tool for boutique fitness studio operators. Its core value proposition is: **"Find out which platform is costing you money — and fix it."**

It solves five concrete pain points:
1. **Payout lag and opacity** — platforms pay monthly with opaque logic; owners can't reconcile variances
2. **Platform cannibalization** — ClassPass/Urban Sports may be displacing higher-yield direct bookings
3. **Cash flow unpredictability** — lagged payouts make forecasting impossible
4. **Price-per-class confusion** — operators don't know their real yield per booking per platform
5. **No-show economics** — platforms handle no-shows differently but this is invisible in current tools

The MVP focuses on (1) and (4). Cash flow forecasting and cannibalization analysis are V1.1 features.

This is an MVP, not a polished SaaS. Speed and simplicity take priority over elegance.

---

## Tech Stack

- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **ORM / Queries:** Supabase JS client (`@supabase/supabase-js`)
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table
- **Charts:** Recharts
- **Date handling:** date-fns
- **CSV parsing:** PapaParse
- **Deployment:** Vercel

---

## Architecture Rules

- Use **App Router** (not Pages Router)
- Use **server components** for read-heavy dashboard pages
- Use **client components** for forms, tables, and interactive filters — add `"use client"` at the top
- Keep state simple: local component state for forms, server fetch / route handlers for CRUD
- No Redux. No Zustand. No external state libraries unless clearly justified.
- Zod schemas live in `/src/lib/validators.ts`
- Revenue and aggregation logic lives in `/src/lib/calculations.ts`
- Insight logic lives in `/src/lib/insights.ts`
- CSV utilities live in `/src/lib/csv.ts`

---

## Database Tables

### `studios`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| currency | text | default: EUR |
| timezone | text | |
| week_start | text | |
| created_at | timestamp | |

### `booking_entries`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| studio_id | uuid | FK → studios |
| date | date | required |
| platform | text | required |
| bookings | integer | >= 0 |
| class_name | text | nullable |
| trainer_name | text | nullable |
| estimated_revenue | numeric | computed on save |
| created_at | timestamp | |
| updated_at | timestamp | |

### `payout_models`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| studio_id | uuid | FK → studios |
| platform | text | |
| avg_payout_per_booking | numeric | |
| payout_lag_days | integer | nullable, used for cash flow forecast in V1.1 |
| updated_at | timestamp | |

### `actual_payouts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| studio_id | uuid | FK → studios |
| month | text | e.g. "2024-04" |
| platform | text | |
| actual_payout_total | numeric | |
| created_at | timestamp | |

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | matches Supabase auth user id |
| studio_id | uuid | FK → studios |
| email | text | |
| created_at | timestamp | |

---

## Auth Rules

- Use Supabase Auth (email/password)
- All routes under `/dashboard`, `/data`, `/data-input`, `/reconciliation`, `/settings` are protected
- Every DB query must be scoped to the authenticated user's `studio_id`
- Use Row Level Security (RLS) in Supabase so queries are safe server-side

---

## Core Calculations

```ts
// Revenue per entry
estimated_revenue = bookings * avg_payout_per_booking

// Dashboard aggregates
today_revenue = SUM(estimated_revenue) WHERE date = today
yesterday_revenue = SUM(estimated_revenue) WHERE date = yesterday
last_7_days_revenue = SUM(estimated_revenue) WHERE date >= today - 6

// Platform metrics
revenue_per_booking = estimated_revenue / total_bookings
revenue_share_pct = platform_estimated_revenue / total_estimated_revenue * 100
yield_gap = direct_revenue_per_booking - platform_revenue_per_booking  // positive = platform costs you money

// Reconciliation
variance_eur = actual_payout_total - estimated_revenue
variance_pct = variance_eur / estimated_revenue * 100

// Cash flow forecast (V1.1 — not in MVP)
// expected_cash_next_30d = SUM(estimated_revenue WHERE date <= today+30)
// adjusted per platform's payout_lag_days field in payout_models
```

---

## Insights Engine

Located in `/src/lib/insights.ts`. Rule-based only — no LLM calls.

### Required insight rules (MVP)

```ts
// Rule 1: Lowest yield platform
"[Platform] has the lowest revenue per booking at €X — consider reviewing your allocation"

// Rule 2: Highest revenue share
"[Platform] accounts for X% of your estimated revenue this week"

// Rule 3: Day-over-day change
"Revenue is up/down X% vs yesterday"

// Rule 4: Yield gap vs direct
"ClassPass bookings yield €X less per booking than direct — equivalent to €Y lost this week"

// Rule 5: Week-over-week (if 14+ days of data)
"This week is tracking X% above/below last week"
```

### V1.1 insight rules (do not build in MVP)
- Platform cannibalization signal: "Direct bookings dropped X% in weeks when ClassPass volume increased"
- Cash flow alert: "€X in payouts expected within the next 30 days"
- Reconciliation anomaly: "[Platform] payout was X% below estimate — consider updating your payout model"

Return all active insights as `string[]`. Render in an insights card on the dashboard. Show max 3 at a time, prioritised by magnitude of impact.

---

## Default Platforms

```ts
const DEFAULT_PLATFORMS = [
  "Direct / Eversports",
  "ClassPass",
  "Urban Sports Club",
  "WellPass",
  "Other",
];
```

---

## VS Code + Codex Workflow

### How to use Claude effectively in this codebase

1. **Always open CLAUDE.md first** in your VS Code session so Claude has full context
2. **Use the prompts/ folder** — pre-written prompt templates live there for every major feature. Copy, fill in any blanks, paste into Claude or Codex.
3. **One feature per session** — never ask Claude to build multiple features in one prompt. Scope tightly.
4. **Show Claude the target file first** — open the file you want Claude to write to, then paste the prompt. Codex will use the open file as context.
5. **Always ask for TypeScript only** — no JS fallbacks, no loose types
6. **After each feature: test locally before moving on** — don't chain unverified code

### Recommended VS Code extensions
- **GitHub Copilot** or **Cody** for inline suggestions
- **Prisma** (even though we use Supabase, useful for schema visualization)
- **Tailwind CSS IntelliSense** — essential for Tailwind
- **ESLint + Prettier** — keep code consistent across sessions
- **Thunder Client** — test API routes without leaving VS Code

### File naming conventions
- Pages: `page.tsx` (App Router convention)
- Components: `PascalCase.tsx`
- Lib files: `camelCase.ts`
- Types: `types/index.ts` or co-located with feature

---

## Prompt Pattern for Claude

When asking Claude to build a feature, always include:

1. **File target** — exact path
2. **Feature scope** — what this component/page does
3. **Inputs / outputs** — props, expected data shape
4. **Constraints** — use shadcn/ui, validate with Zod, minimal implementation

**Example:**

```
Build a Next.js App Router page at /settings that loads payout models from 
Supabase for the authenticated user's studio. Use shadcn/ui table and dialog 
components. Allow creating and editing payout models with fields: platform 
and avg_payout_per_booking. Validate with Zod and React Hook Form. Return 
TypeScript code only. Keep it minimal and working.
```

---

## What NOT to Build (MVP Scope)

Do not add the following unless explicitly requested. These are V1.1 or V2 features:

| Feature | Target version |
|---|---|
| API integrations with Eversports, ClassPass, Urban Sports | V2 |
| PDF ingestion or OCR | V2 |
| Email forwarding or automated parsing | V2 |
| Scraping | V2 |
| Multi-location / multi-studio support | V2 |
| Payroll, invoicing, or accounting features | Out of scope |
| Confidence intervals or pricing engine sophistication | V2 |
| AI-generated insights | Out of scope (keep rule-based) |
| Cash flow forecasting | V1.1 |
| Platform cannibalization analysis | V1.1 |
| Break-even per class calculator | V1.1 |
| "Should I accept this platform?" advisor | V1.1 |
| Payout lag tracking | V1.1 — add `payout_lag_days` column to schema now, but don't build the UI yet |

---

## Code Style

- TypeScript strict mode — no `any`
- Prefer named exports
- Keep components focused and small
- Co-locate types with their usage unless shared (then put in `/src/types`)
- Use `date-fns` for all date logic — no `moment.js`
- Use `PapaParse` for CSV — do not build a custom parser
- Label all revenue values as **estimated** in the UI

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Key Principles

1. **Speed over elegance** — working in 48 hours beats perfect in 2 weeks
2. **Directional truth over exact truth** — this is an estimation tool
3. **Manual first, automate later** — don't add automation until friction is proven
4. **Insights over raw data** — always surface something useful, never just show tables
5. **Low cognitive load** — designed for operators, not finance professionals
6. **Yield over volume** — always show revenue per booking alongside raw booking counts; volume without yield is misleading
7. **Reconciliation is a first-class feature** — not a secondary page; it's how operators discover platform problems
