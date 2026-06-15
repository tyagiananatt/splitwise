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

## Four Cases Where AI Was Wrong

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

**The problem:** `npm create vite` installs **Tailwind CSS v4**, not v3. Tailwind v4 moved its PostCSS plugin to a separate package (`@tailwindcss/postcss`) and replaced the `@tailwind` directives with `@import "tailwindcss"`. The generated config was written for v3. Running `npm run build` threw:

```
Error: [postcss] It looks like you're trying to use `tailwindcss` directly as a
PostCSS plugin. The PostCSS plugin has moved to a separate package...
```

**How I caught it:** The build failed with a specific, clear error message. I read the error rather than just re-prompting.

**What I changed:**
1. Ran `npm install -D @tailwindcss/postcss`
2. Changed `postcss.config.js` to `'@tailwindcss/postcss': {}`
3. Rewrote `index.css` to use `@import "tailwindcss"` (v4 syntax)
4. Removed `tailwind.config.js` — v4 uses CSS-based configuration, not a JS config file

This was a knowledge cutoff problem. The AI's training data reflects v3 patterns; the runtime environment had v4.

---

### Case 2: Settlement detection missed the case where the payer and payee are swapped in a negative-amount row

**What was generated:**
```ts
function detectSettlement(row: CSVRow): boolean {
  const keywords = ['pays', 'reimburse', 'settlement', 'repay'];
  const hasKeyword = keywords.some(k => row.description.toLowerCase().includes(k));
  const isNegative = parseFloat(row.amount) < 0;
  return hasKeyword || isNegative;
}
```

When a settlement was detected, the generated code converted it to a `Settlement` record like this:

```ts
const settlement: Settlement = {
  payerId: row.paidById,   // the person in "Paid By" column
  payeeId: extractPayee(row.description),
  amount: Math.abs(parseFloat(row.amount)),
};
```

**The problem:** For Row 17 in the CSV (`Meera pays Aisha | -500 | Paid By: Meera`), the "Paid By" column correctly identifies Meera as the one transferring money. But for Row 38 (`Rohan pays Priya | 300 | Paid By: Rohan`), the description says "Rohan pays Priya" — meaning Rohan is reducing his debt to Priya. The AI's `extractPayee()` parsed the description using a simple `"X pays Y"` regex and returned Priya as the payee correctly here.

However, I then tested a case where the description was phrased differently: `"Priya received from Rohan"`. In this phrasing, the payee is the grammatical subject, not the object — and `extractPayee()` returned `Priya` as the payer and `Rohan` as the payee, which is reversed. The settlement would have credited the wrong person and doubled the error in both balances.

**How I caught it:** I manually tested the balance output after importing a settlement with reversed phrasing. Rohan's balance went in the wrong direction — he showed as being owed money rather than having paid money. I traced it back through `simplifyDebts()` → `calculateBalances()` → the settlement record itself and found the payer/payee were swapped.

**What I changed:**

Replaced the fragile regex-based payee extraction with a three-signal consensus approach:
1. Parse `"X pays Y"` / `"X reimburses Y"` patterns for the common case
2. Use the `Split Between` column — if it contains only the payer, the payee must be derived from context
3. Fall back to flagging the row as `SETTLEMENT_AMBIGUOUS` in the review UI, forcing the user to manually confirm who is paying whom before the row is imported

This made the settlement detection robust instead of brittle on description phrasing.

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
- User B logs in → their dashboard showed no groups, because the balance calculation did `balances.find(b => b.userId === user.id)` on unfiltered data — and since User B's `userId` wasn't matching (placeholder issue), it returned undefined
- A user who was not added to a group could navigate to `/groups/:id` directly and see all its data

The AI generated the store correctly but did not generate the scoping logic that makes it safe.

**How I caught it:** I tested with two demo accounts. Logged in as Aisha, created a group, logged out, logged in as Rohan. Rohan's dashboard showed no groups even though "The Flat" existed and he was a member. I traced the store reads — `useAppStore().groups` was returning all groups correctly, but the Dashboard was not filtering by membership at all.

**What I changed:**
1. Added `getGroupsForUser(userId)` and `getExpensesForUser(userId)` as selector methods on the store
2. Updated all 8 affected files (Dashboard, Groups, Balances, Expenses, ExpenseNew, Import, Layout, GroupDetail) to use these selectors instead of raw arrays
3. Added a membership guard to `GroupDetail.tsx`: if `!group.members.some(m => m.userId === user.id)` → render "you're not a member of this group"

This was a systemic architectural issue, not a typo. The AI scaffolded the happy path but did not think through the multi-user security model.

---

### Case 4: Debt simplification produced incorrect results when a user had both paid for expenses and settled a debt in the same group

**What was generated (`lib/balances.ts`):**
```ts
function calculateBalances(group: Group, expenses: Expense[], settlements: Settlement[]) {
  const netMap: Record<string, number> = {};

  // Step 1: process expenses
  for (const expense of expenses) {
    netMap[expense.paidById] = (netMap[expense.paidById] ?? 0) + expense.amountInr;
    for (const share of expense.shares) {
      netMap[share.userId] = (netMap[share.userId] ?? 0) - share.shareAmount;
    }
  }

  // Step 2: process settlements — applied separately after expenses
  for (const settlement of settlements) {
    netMap[settlement.payerId] = (netMap[settlement.payerId] ?? 0) + settlement.amount;
    netMap[settlement.payeeId] = (netMap[settlement.payeeId] ?? 0) - settlement.amount;
  }

  return netMap;
}
```

**The problem:** The sign convention for settlements was inverted. When Rohan pays Aisha ₹300 to settle a debt, Rohan's balance should *increase* (he owes less, moving toward zero) and Aisha's should *decrease* (she is owed less). But the generated code did the opposite — it added the settlement amount to the payer (`netMap[payerId] += amount`) as if Rohan had paid for another shared expense, and subtracted it from the payee as if Aisha had consumed it.

In practice: Rohan had a net balance of −₹750 (he owed ₹750). After settling ₹300 to Aisha, his balance should become −₹450. Instead, the generated code made it −₹1050. The settlement was making the debt worse.

**How I caught it:** After importing the CSV including Row 38 (Rohan pays Priya ₹300), I checked Rohan's balance on the Balances page. It showed −₹1050 instead of the expected −₹450. I added `console.log` statements to `calculateBalances()` at each step and traced through a single settlement manually on paper. The sign flip was immediately visible — the payer and payee directions were both wrong.

**What I changed:**

Inverted both signs in the settlement block:
```ts
// Correct: payer's debt reduces (net goes up toward 0)
netMap[settlement.payerId] = (netMap[settlement.payerId] ?? 0) - settlement.amount;
// Correct: payee receives less (net goes down)
netMap[settlement.payeeId] = (netMap[settlement.payeeId] ?? 0) + settlement.amount;
```

I also added a unit test (in comments in `balances.ts`) with the manual calculation for the Rohan/Priya case so the invariant is documented inline. This was a pure logic error — the AI modelled the concept correctly in prose (settlements reduce debt) but implemented the arithmetic in the wrong direction.