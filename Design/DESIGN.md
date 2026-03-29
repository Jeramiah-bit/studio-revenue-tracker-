# Design System Strategy: The Financial Atelier

## 1. Overview & Creative North Star
**The Creative North Star: "The Financial Atelier"**
Most financial dashboards feel like cold spreadsheets. For this design system, we are building a "Financial Atelier"—a space that feels bespoke, calm, and curated. We are moving away from the "standard SaaS" look of boxes-inside-boxes. Instead, we treat the UI as a single, continuous canvas where information is revealed through light and depth rather than lines and borders.

The system breaks the "template" look by utilizing **intentional asymmetry**. Primary data visualizations (like revenue charts) should command expansive breathing room, while secondary controls are tucked into sophisticated, layered drawers. By leaning into high-contrast typography scales and overlapping surface tiers, we create a signature experience that feels as premium as a boutique fitness studio itself.

---

## 2. Colors & Surface Philosophy
Color is used with surgical precision. Our palette is anchored by the deep, authoritative `on_surface` (#113069) and the vibrant, kinetic `primary` (#004CED).

### The "No-Line" Rule
To achieve a high-end editorial feel, **1px solid borders are prohibited for sectioning.** We do not "box" content. Instead, boundaries are defined strictly through background shifts. 
- Use `surface` (#FAF8FF) for the main page background.
- Use `surface_container_low` (#F2F3FF) to define a sidebar or a secondary content area.
- Place critical utility bars on `surface_container_highest` (#D9E2FF).

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of fine paper. 
- **Base Level:** `surface`
- **In-Page Sections:** `surface_container`
- **Interactive Cards:** `surface_container_lowest` (Pure #FFFFFF)
By placing a `surface_container_lowest` card on a `surface_container_low` background, we create a "natural lift" that feels architectural rather than digital.

### The "Glass & Gradient" Rule
Standard flat buttons are for standard apps. For this design system:
- **Primary CTAs:** Use a subtle linear gradient from `primary` (#004CED) to `primary_dim` (#0042D1) at a 135° angle.
- **Floating Overlays:** Use `surface_bright` with a 70% opacity and a `backdrop-blur` of 12px. This "Glassmorphism" ensures the dashboard feels deep and integrated.

---

## 3. Typography: Editorial Authority
We use **Inter** as our sole typeface, relying on extreme scale and weight contrast to establish hierarchy.

- **The Power Scale:** Use `display-md` (2.75rem) for the "Hero Number" (e.g., Monthly Recurring Revenue). It should be bold and unapologetic.
- **Contextual Labels:** Use `label-sm` (#0.6875rem) in All Caps with +5% letter spacing for category headers. This mimics high-end print journalism.
- **Narrative Body:** `body-lg` (1rem) is used for insights and descriptions, providing a comfortable reading experience for non-technical owners.

Typography isn't just for reading; it's a UI element. Use `on_surface_variant` (#445D99) for secondary data to ensure the primary "Money" numbers (in `on_surface`) always win the eye's attention.

---

## 4. Elevation & Depth
We eschew "Material Design" style heavy shadows in favor of **Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking." A white card (`surface_container_lowest`) sitting on a pale blue wash (`surface_container_low`) creates a sophisticated separation without a single line of CSS border.
- **Ambient Shadows:** For "floating" elements like modals or dropdowns, use a signature shadow: `0px 20px 40px rgba(17, 48, 105, 0.06)`. Note that the shadow is tinted with our `on_surface` blue, not black.
- **The "Ghost Border":** If a border is required for accessibility (e.g., input fields), use `outline_variant` (#98B1F2) at 20% opacity. It should be felt, not seen.
- **Glassmorphism:** Use semi-transparent `surface_container_lowest` with a blur for top navigation bars. As the user scrolls their financial data, the colors should bleed softly through the header.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_dim`), `on_primary` text, `lg` (0.5rem) roundedness.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary:** Pure text using `primary` color with a 2px underline appearing only on hover.

### Cards & Lists
**Strict Rule:** No divider lines. 
- Separate list items using `spacing-4` (1rem) of vertical white space.
- Alternatively, use alternating background tints: Item 1 on `surface`, Item 2 on `surface_container_low`.

### Input Fields
- Background: `surface_container_lowest`.
- Border: "Ghost Border" (20% `outline_variant`).
- On Focus: Border becomes 100% `primary` with a 4px soft outer glow of `primary_container`.

### The "Studio Stat" Component (Custom)
A bespoke component for fitness metrics (e.g., "Class Attendance").
- Large `headline-lg` number.
- A mini sparkline graph using `primary` with a `primary_container` area fill.
- No container box; the data sits "naked" on the `surface`, using white space to define its territory.

---

## 6. Do's and Don'ts

### Do
- **Do** use `spacing-12` (3rem) and `spacing-16` (4rem) between major sections. Generous breathing room equals a "Premium" feel.
- **Do** use `primary_container` (#DDE1FF) as a background for positive growth indicators.
- **Do** treat every page as an editorial layout. Align text to a strict baseline but allow images or charts to "break the grid" slightly for visual interest.

### Don't
- **Don't** use 100% black (#000000) for text. Use `on_surface`.
- **Don't** use standard 1px grey borders. They make the dashboard feel like "software" rather than a "service."
- **Don't** clutter the screen. If a studio owner doesn't need to see a metric daily, hide it in a "surface-container" drawer.
- **Don't** use aggressive "Error Red." Use `error` (#9E3F4E) sparingly, and always pair it with `on_error` for a soft, legible warning.