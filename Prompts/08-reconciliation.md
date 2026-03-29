# Prompt 08 — Reconciliation Page

Paste this into Claude or Codex after completing prompt 06.

---

## Prompt

Build the Reconciliation page for StudioRevenue at `/src/app/(app)/reconciliation/page.tsx`.

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui.

### Feature overview
Operators enter their actual monthly platform payouts and compare them against StudioRevenue's estimates. This surfaces where estimates are wrong and helps operators update their payout models.

### Section 1: Month Selector
- Dropdown or tabs to select a month (e.g. "March 2025")
- Default to current month
- Show last 6 months as options

### Section 2: Add Actual Payout Form
- Fields:
  - Month (pre-filled from selector)
  - Platform (select from studio's payout models)
  - Actual Payout Total (€, number input)
- Validate with Zod + React Hook Form
- On submit: upsert to Supabase `actual_payouts` table
- Show success toast

### Section 3: Reconciliation Table
For the selected month, show a table with one row per platform:

Columns:
- Platform
- Estimated Revenue (€) — sum of booking_entries for that month + platform
- Actual Payout (€) — from actual_payouts table (editable inline or via form)
- Variance (€) — actual - estimated
- Variance (%) — variance / estimated * 100
- Status badge: green if within ±10%, amber if ±10–25%, red if >25% off

**Empty state per platform:** "No actual payout entered yet" with an "Add" button

### Section 4: Summary Cards
Above the table, show:
- Total estimated revenue for the month
- Total actual payouts entered
- Overall variance (€ and %)

### Calculations
```ts
variance_eur = actual_payout_total - estimated_revenue
variance_pct = (variance_eur / estimated_revenue) * 100
```

### Constraints
- Mix of server (data fetch) and client (form, month selector) components
- TypeScript strict, no `any`
- shadcn/ui: Card, Table, Select, Input, Button, Badge, Toast
- Always label estimated figures as "estimated"

Return TypeScript code only.
