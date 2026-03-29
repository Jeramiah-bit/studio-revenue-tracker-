# Prompt 07 — CSV Import

This is already covered in Prompt 04 (Data Input page, Section 2).

If you need to extract the CSV import into its own reusable component, use this prompt.

---

## Prompt

Refactor the CSV import functionality from the Data Input page into a standalone reusable component at `/src/components/data/CsvImport.tsx`.

The component should:
- Accept a `studioId: string` and `payoutModels: PayoutModel[]` as props
- Handle file selection (accept .csv only)
- Parse with PapaParse
- Show column mapping UI
- Show 5-row preview
- Validate rows (date required, platform required, bookings >= 0, platform must exist in payoutModels)
- On import: calculate estimated_revenue per row and batch insert to Supabase
- Show result: "X rows imported, Y rows rejected"
- Show rejected rows with reason

### Column mapping UI
User maps their CSV column headers to these fields:
- date → required
- platform → required
- bookings → required
- class_name → optional
- trainer_name → optional

Use shadcn/ui Select for each mapping dropdown.

### Constraints
- "use client"
- TypeScript strict, no `any`
- Import PapaParse dynamically: `const Papa = await import('papaparse')`
- Handle encoding issues gracefully
- Show loading state during import

Return TypeScript code only.
