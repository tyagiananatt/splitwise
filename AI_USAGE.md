# AI_USAGE.md — AI Tool Usage Log

---

## Tool Used

**Claude (Anthropic)** — accessed via **Kiro IDE** (VS Code extension with agentic coding capability).

Kiro wraps Claude in an agentic loop: it reads files, writes code, runs builds, catches errors, and iterates — but every output is reviewed and either accepted, edited, or rejected before being committed. I remained the engineer of record for every line in this repository.

---

## How I Used It

The workflow was:
1. I described what I wanted in natural language (intent + constraints).
2. Kiro/Claude generated the code or file.
3. I reviewed the output — read it, ran the build, tested the behaviour in the browser.
4. I either accepted it, edited it inline, or corrected it with a follow-up prompt.
5. Commits were made only after I had read and understood every changed line.

---

## Key Prompts

**Prompt 1 — Initial scaffold**
> "Build a shared expenses app in React + Vite + TypeScript for a flatmate scenario. Requirements: login/register, groups with temporal membership (join and leave dates), add expenses with equal/exact/percentage splits, multi-currency with INR conversion, balance calculation with debt simplification, CSV import with anomaly detection for expenses_export.csv. Deploy to Vercel — no backend required."

*Output:* Project structure, `package.json`, all page scaffolds, store design, routing.

---

**Prompt 2 — CSV anomaly detection**
> "Implement the CSV importer for expenses_export.csv. It must detect: exact duplicates, near-duplicates (same description/date/payer but different amounts), settlements logged as expenses (using keyword detection and negative amounts), foreign currency without conversion, expenses after a member left or before they joined, invalid dates, missing fields, zero amounts, and split mismatches for exact/percentage types. Every anomaly must surface to the user — nothing can be silently dropped or silently fixed."

*Output:* `lib/csvImporter.ts` — the `parseAndAnalyseCSV()` function with all 14 anomaly types.

---

**Prompt 3 — Balance engine**
> "Implement balance calculation for a group. For each user: sum what they paid, subtract their share of each expense, then apply settlements. Return a per-user breakdown showing which expenses contributed to their net balance (for Rohan's requirement: 'if the app says I owe ₹2300 I want to see exactly which expenses make that up'). Implement greedy debt simplification — minimum transactions to clear all debts."

*Output:* `lib/balances.ts` — `calculateBalances()` and `simplifyDebts()`.

---

**Prompt 4 — Import review UI**
> "Build the import page. Three steps: upload, review, done. In the review step, show every parsed row with: a green/yellow/red status dot, the row's description/amount/date, number of anomalies, and a checkbox to include or skip. Anomalies should be expandable — show type, message, detail, and an action dropdown the user can override. Sticky bottom bar shows count of rows being imported and a confirm button. After confirming, show a summary and a download button for the full report as a .txt file."

*Output:* `pages/Import.tsx` — full review wizard.

---

**Prompt 5 — Member linking system**
> "Fix the member-without-account problem. When an admin adds a member by email, look up the email in a user registry. If registered, use their real userId. If not, store a placeholder keyed to their email. When they register, scan all groups for placeholder members with their email and call relinkMember() — this must atomically patch: group members array, all expense paidById/paidByName, all expense shares (userId + userName), and all settlements."

*Output:* `lib/userRegistry.ts`, updated `Register.tsx`, `GroupNew.tsx`, `GroupDetail.tsx`, and `relinkMember()` in `appStore.ts`.

---

**Prompt 6 — Group visibility scoping**
> "Every page is showing all groups to all users. Add two selector functions to appStore: getGroupsForUser(userId) and getExpensesForUser(userId). Update every page — Dashboard, Groups, Balances, Expenses, ExpenseNew, Import, Layout sidebar — to use these selectors instead of the raw store arrays. Add a membership guard to GroupDetail that blocks access if the current user is not in the group's members list."

*Output:* Updated all 8 files with correct selectors and the membership guard.

---

## Three Cases Where AI Was Wrong

### Case 1: PostCSS configuration was incorrect for the Tailwind/Vite version in use

**What was generated:**
```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

And in `index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**The problem:** `npm create vite` in June 2025 installs **Tailwind CSS v4**, not v3. Tailwind v4 moved its PostCSS plugin to a separate package (`@tailwindcss/postcss`) and replaced the `@tailwind` directives with `@import "tailwindcss"`. The generated config was written for v3. Running `npm run build` threw:

```
Error: [postcss] It looks like you're trying to use `tailwindcss` directly as a
PostCSS plugin. The PostCSS plugin has moved to a separate package, so to
continue using Tailwind CSS with PostCSS you'll need to install @tailwindcss/postcss
```

**How I caught it:** The build failed with a specific, clear error message. I read the error rather than just re-prompting.

**What I changed:**
1. Ran `npm install -D @tailwindcss/postcss`
2. Changed `postcss.config.js` to `'@tailwindcss/postcss': {}`
3. Rewrote `index.css` to use `@import "tailwindcss"` (v4 syntax)
4. Removed `tailwind.config.js` — v4 uses CSS-based configuration, not a JS config file

This was a knowledge cutoff problem. The AI's training data reflects v3 patterns; the runtime environment had v4.

---

### Case 2: Zustand store used `(set, get)` but `get` was never used — caused TypeScript build failure

**What was generated:**
```ts
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ... no usage of `get` anywhere in the object
    }),
    { name: 'splitwise-data' }
  )
);
```

**The problem:** TypeScript strict mode with `noUnusedLocals: true` (Vite's default) treats unused function parameters as errors when they are named. The build failed with:

```
src/store/appStore.ts: error TS6133: 'get' is declared but its value is never read.
```

**How I caught it:** `npm run build` output. The error was on a specific line.

**What I changed:** Changed `(set, get) => ({` to `(set) => ({`. When the `getGroupsForUser` and `getExpensesForUser` selectors were later added (requiring `get()` to read current state), I changed it back to `(set, get) => ({` — this time `get` was genuinely used.

This was a minor issue but illustrates why you must always run the build rather than assume generated code compiles.

---

### Case 3: All pages read the entire `groups` and `expenses` arrays — no scoping by current user

**What was generated (example from `Dashboard.tsx`):**
```ts
const { groups, expenses, settlements } = useAppStore();
// groups = ALL groups for ALL users
// expenses = ALL expenses for ALL groups
```

**The problem:** The app stores all users' data in a single shared localStorage key (`splitwise-data`). The generated pages read the entire unfiltered store, which means:
- User A creates "Hostel" group and adds User B
- User B logs in → their dashboard shows nothing, because the store `groups` array contains "Hostel" but the code that calculates "my balance" did `balances.find(b => b.userId === user.id)` — and since User B's `userId` wasn't in the group yet (placeholder issue), it returned undefined
- Conversely, a user who was *not* added to a group could still navigate to `/groups/:id` directly and see all its data

The AI generated the store correctly (all data in one place for simplicity) but did not generate the scoping logic that makes it safe.

**How I caught it:** I tested with two demo accounts. Logged in as Aisha, created a group, logged out, logged in as Rohan. Rohan's dashboard showed no groups even though "The Flat" existed and he was a member. I traced the store reads — `useAppStore().groups` was returning all groups correctly, but the Dashboard was not filtering by membership at all.

**What I changed:**
1. Added `getGroupsForUser(userId)` and `getExpensesForUser(userId)` as selector methods on the store
2. Updated all 8 affected files (Dashboard, Groups, Balances, Expenses, ExpenseNew, Import, Layout, GroupDetail) to use these selectors instead of raw arrays
3. Added a membership guard to `GroupDetail` that blocks direct URL access by non-members
4. Added a membership guard to `GroupDetail.tsx`: if `!group.members.some(m => m.userId === user.id)` → render "you're not a member of this group"

This was a systemic architectural issue, not a typo. The AI scaffolded the happy path but did not think through the multi-user security model.
