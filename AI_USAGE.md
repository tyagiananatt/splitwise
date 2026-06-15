# AI_USAGE.md

## AI Tool Used

**Claude (Anthropic)** via Kiro IDE (VS Code extension)

---

## Key Prompts Used

1. **"Build a shared expenses app in React with: auth, groups with temporal membership, equal/exact/percentage splits, multi-currency, and a CSV importer that detects 12+ anomalies"**
   — Generated initial project scaffold and file structure.

2. **"Implement the CSV anomaly detection for expenses_export.csv — detect exact duplicates, near-duplicates, settlements logged as expenses, negative amounts, foreign currency, and member temporal mismatches"**
   — Generated the `csvImporter.ts` logic.

3. **"Implement the Zustand balance calculation that handles settlements and gives per-expense breakdown (for Rohan's 'I want to see exactly which expenses make up my ₹2300')"**
   — Generated `lib/balances.ts`.

4. **"Build the import review UI — every row shown with toggle, anomaly detail expandable, action override dropdown, sticky confirm bar"**
   — Generated `pages/Import.tsx`.

5. **"Fix TypeScript unused-import errors in all files"**
   — Generated targeted fixes for each TS6133 error.

---

## Three Cases Where AI Was Wrong

### Case 1: Wrong PostCSS configuration

**What AI generated:**
```js
// postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```
**The problem:** Vite 8 ships with Tailwind CSS v4, which moved its PostCSS plugin to `@tailwindcss/postcss`. Using `tailwindcss` directly in the plugins object throws a runtime error: *"The PostCSS plugin has moved to a separate package."*

**How I caught it:** The build failed with a clear error message pointing at the PostCSS configuration.

**What I changed:** Installed `@tailwindcss/postcss` and updated the config to `'@tailwindcss/postcss': {}`. Also rewrote `index.css` to use `@import "tailwindcss"` (v4 syntax) instead of `@tailwind base/components/utilities` (v3 syntax).

---

### Case 2: appStore using `(set, get)` with unused `get`

**What AI generated:**
```ts
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({   // ← 'get' declared but never used
```
**The problem:** TypeScript strict mode flags `get` as unused (TS6133), causing the build to fail.

**How I caught it:** `npm run build` reported `error TS6133: 'get' is declared but its value is never read`.

**What I changed:** Changed `(set, get) => ({` to `(set) => ({` since none of the store actions needed to read current state via `get()`.

---

### Case 3: Near-duplicate detection false-positiving on the March 10 dinner

**What AI generated:**
The near-duplicate detection used `date|description|paidBy` as the similarity key. Row 9 (Mar 10) and Row 14 (Mar 10) both have `description="Dinner out"` and `paidBy="Aisha"` — so they triggered a near-duplicate warning even though one is the "March dinner" and the other was (incorrectly) labelled "Valentines dinner" in a March row.

**The problem:** This is actually intentional in the dataset — but the AI-generated detection was triggering for legitimately different entries that happened to share description/date/payer.

**How I caught it:** Manually reviewing the CSV and tracing the detection logic. Row 9 in the CSV is dated `2024-03-10` with notes "Valentines dinner" — this is a data problem in the CSV (wrong month), not a duplicate detection problem.

**What I changed:** The detection correctly flags it as a near-duplicate (same key, different amount is a signal). The review UI surfaces it to the user with a clear message, letting them decide — which is the right behavior. I also added this to the anomaly log in SCOPE.md as a documented data problem.
