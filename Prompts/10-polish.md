# Prompt 10 — Polish, Empty States + Loading Skeletons

Paste this into Claude or Codex as the final pass before deployment.

---

## Prompt

Add polish to the StudioRevenue app. Focus on empty states, loading skeletons, and responsive layout. Do not change any existing logic or data fetching.

### 1. Empty states

Create a reusable component at `/src/components/ui/EmptyState.tsx`:
```ts
// Props: title, description, actionLabel?, onAction?
// Renders a centered card with an icon, title, description, and optional CTA button
```

Apply empty states to:
- Dashboard: "No bookings yet. Add your first booking to start tracking revenue." → link to /data-input
- Data page: "No entries found. Try adjusting your filters or add a booking."
- Reconciliation: "No data for this month yet."
- Settings payout models: "No platforms configured yet. Add your first payout model."

### 2. Loading skeletons

Create a reusable `<Skeleton />` component (shadcn/ui already includes this — use it).

Apply skeletons to:
- Dashboard KPI cards (3 card-shaped skeletons while loading)
- Platform performance table (5 row skeletons)
- Data table (8 row skeletons)
- Reconciliation table (4 row skeletons)

### 3. Responsive layout fixes

- Sidebar: on mobile (< 768px), hide sidebar and show a hamburger menu that opens a sheet (shadcn/ui Sheet component)
- Dashboard KPI cards: stack vertically on mobile, 3-column grid on desktop
- All tables: horizontally scrollable on mobile with `overflow-x-auto`
- Forms: full width on mobile, max-w-lg centered on desktop

### 4. Global "estimated" label

Create a reusable `<EstimatedBadge />` component:
- Small grey badge with text "Estimated"
- Use it next to every revenue figure across the app
- This reinforces that figures are not accounting-grade

### 5. Page titles
Add a consistent `<PageHeader title="" description="" />` component at the top of each page:
- Dashboard: "Dashboard" / "Your estimated revenue at a glance"
- Data Input: "Data Input" / "Log bookings manually or import a CSV"
- Data: "Bookings" / "View and manage all your booking entries"
- Reconciliation: "Reconciliation" / "Compare estimated vs actual payouts"
- Settings: "Settings" / "Configure your studio and payout models"

### Constraints
- shadcn/ui components only for UI primitives
- TypeScript strict
- No logic changes — presentation only
- Keep all changes minimal and working

Return TypeScript code only, one component at a time.
