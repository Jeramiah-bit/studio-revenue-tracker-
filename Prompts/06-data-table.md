# Prompt 06 — Data Table Page

Paste this into Claude or Codex after completing prompt 05.

---

## Prompt

Build the Data page for StudioRevenue at `/src/app/(app)/data/page.tsx`.

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table.

### Feature: Full Booking Entries Table

**Filters (above the table)**
- Date range picker: from / to (use shadcn/ui Popover + Calendar or simple date inputs)
- Platform filter: multi-select or dropdown of all platforms in the studio's data
- Both filters update the table in real time (client-side filtering)

**Table columns**
- Date
- Platform
- Bookings
- Estimated Revenue (€)
- Revenue per Booking (€)
- Class Name
- Trainer Name
- Actions (Edit, Delete)

**Edit action**
- Opens a shadcn/ui Dialog with pre-filled form (same fields as booking entry form)
- On save: recalculate estimated_revenue, update in Supabase, refresh table
- Validate with Zod

**Delete action**
- shadcn/ui AlertDialog confirmation: "Are you sure you want to delete this entry?"
- On confirm: delete from Supabase, remove from table

**Table features**
- Sortable columns (date, platform, revenue)
- Pagination (10 rows per page)
- Show total count: "Showing X of Y entries"

**Empty state**
- If no entries: "No bookings found. Add your first booking in Data Input."

### Data
- Fetch all booking_entries for the studio from Supabase on load
- Filter/sort client-side for responsiveness
- Reload data after any edit or delete

### Constraints
- Mix of server (initial fetch) and client (filtering, mutations) components
- TypeScript strict, no `any`
- Use TanStack Table for the table logic
- Use shadcn/ui for all UI elements
- Keep edit/delete actions in the table row

Return TypeScript code only.
