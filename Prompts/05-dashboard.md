# Prompt 05 — Dashboard Page

Paste this into Claude or Codex after completing prompt 04.

---

## Prompt

Build the Dashboard page for StudioRevenue at `/src/app/(app)/dashboard/page.tsx`.

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui. This is a server component where possible — use async/await with the Supabase server client for data fetching.

### Section 1: KPI Cards

Show 3 cards at the top:
- **Today's Revenue** — sum of estimated_revenue where date = today (in studio's timezone)
- **Yesterday's Revenue** — sum where date = yesterday
- **Last 7 Days Revenue** — sum where date >= today - 6

Each card:
- Label: "Estimated Revenue" (always label as estimated — never imply exact)
- Show value in studio currency (e.g. €1,240)
- Show +/- % change vs the equivalent prior period where possible
- Use shadcn/ui Card

### Section 2: Platform Performance Table

Aggregate booking_entries for the last 30 days, grouped by platform.

Columns:
- Platform
- Bookings (total)
- Estimated Revenue (€)
- Revenue per Booking (€) — highlight lowest in amber, highest in green
- Revenue Share (%) — each platform's share of total

Use TanStack Table or a simple shadcn/ui Table.

### Section 3: Insights Panel

Import and call `generateInsights(entries, payoutModels)` from `/src/lib/insights.ts` (this will be built in prompt 09 — for now just stub it returning an empty array).

Render insights as a list of plain-language strings in a shadcn/ui Card.
Label the card "Insights" with a small "Beta" badge.

### Section 4: Recent Entries

Show the 10 most recent booking_entries in a simple table:
- Date, Platform, Bookings, Estimated Revenue, Class Name

### Data fetching
- All queries scoped to authenticated user's studio_id
- Fetch in parallel where possible using Promise.all

### Constraints
- Server component for data fetching
- Client components only for interactive elements
- TypeScript strict, no `any`
- Show loading skeleton if needed
- Show empty state if no data yet ("Add your first booking to get started")
- Currency format: always show € symbol and 2 decimal places

Return TypeScript code only.
