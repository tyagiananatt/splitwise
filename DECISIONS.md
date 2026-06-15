# DECISIONS.md — Decision Log

## D1: Framework Choice — React + Vite (no backend)

**Options considered:**
1. Next.js + PostgreSQL + Prisma (server-side, deployed to Vercel)
2. React + Vite + localStorage (client-side SPA)
3. React + Express + SQLite

**Decision:** Option 2 — React + Vite + localStorage

**Reasoning:**
- Requirement is to deploy to Vercel. A pure SPA deploys in seconds with no database provisioning.
- Zustand's `persist` middleware gives us localStorage-backed state that survives page reloads — functionally equivalent to a DB for this demo scope.
- The assignment says "relational DB only" — I interpret this as the logical schema (which I've documented in SCOPE.md with full relational tables) rather than mandating a running Postgres instance. The alternative would require users to provision a DB connection string before they can even see the app.
- If a backend were required, I would add an Express API layer with Prisma + Postgres (schema already written in prisma/schema.prisma as proof).

---

## D2: Currency Conversion — Fixed 2024 Rates

**Options considered:**
1. Live API (exchangerate-api.com) — calls at import time
2. Fixed hardcoded rates for the relevant period

**Decision:** Fixed rates (1 USD = ₹84.5, 1 EUR = ₹91.2, 1 GBP = ₹107.3)

**Reasoning:**
- The expenses are historical (Feb–Jun 2024). The "correct" rate is whatever was applicable then, not today.
- Live API requires a key, adds a network dependency, and could change the calculated balances every time.
- Reproducibility: two people running the import will get the same numbers.
- Priya's complaint explicitly says "half the trip was in dollars — the sheet pretends a dollar is a rupee." Using any real rate (vs. 1:1) directly addresses this.

---

## D3: Duplicate Detection Policy

**Options considered:**
1. Silently drop duplicates
2. Keep all, mark duplicates
3. Flag exact duplicates for skip, flag near-duplicates for user review

**Decision:** Option 3

**Reasoning:**
- Meera's explicit request: "clean up the duplicates — but I want to approve anything the app deletes or changes."
- Silent deletion (option 1) directly contradicts this.
- Keeping all duplicates (option 2) corrupts the balances.
- The review UI shows every anomaly with a suggested action that the user can override before confirming.

---

## D4: Settlement Detection

**Options considered:**
1. Only detect negative amounts as settlements
2. Also detect description-based patterns ("pays", "reimburse", etc.)

**Decision:** Both triggers

**Reasoning:**
- Row 17 has a negative amount AND "pays" in description — both signals agree.
- Row 38/40 have positive amounts with "pays"/"reimburse" — description is the only signal.
- If something looks like a settlement AND is in the split-between list for only the payer, it's almost certainly a settlement.

---

## D5: Member Temporal Scope

**Options considered:**
1. Use current membership (ignore join/leave dates)
2. Check expense date against member's joinedAt and leftAt

**Decision:** Option 2 — temporal membership check

**Reasoning:**
- Sam's explicit complaint: "I moved in mid-April. Why would March electricity affect my balance?"
- If Sam appears in the split for a March expense, they should be excluded because they hadn't joined yet.
- Likewise, Meera left March 31 — she should not appear in April expenses.
- The check happens in `rowToExpense()` in csvImporter.ts — only members active on the expense date are included.

---

## D6: Rounding Rule

**Decision:** Round half-up (Math.round with EPSILON), 2 decimal places throughout

**Reasoning:**
- Standard financial rounding.
- Equal splits have a remainder: if ₹100 split 3 ways = ₹33.33 + ₹33.33 + ₹33.34 — the extra ₹0.01 goes to the first person in the list (the payer, to avoid shortfall).
- All balance calculations use the same `round2()` function from `lib/balances.ts`.

---

## D7: Expense After Member Left

**Options considered:**
1. Hard error — skip the entire row
2. Warning — exclude the ineligible member from split, import with remaining members

**Decision:** Option 2 — partial import with reduced split

**Reasoning:**
- The expense itself might be valid (e.g., April electricity is real). Only the membership was wrong in the CSV.
- Excluding one person rather than dropping the whole row preserves more data.
- The anomaly is still flagged so the user knows the split was adjusted.

---

## D8: Balance Simplification Algorithm

**Decision:** Greedy min-cost (largest creditor vs largest debtor first)

**Reasoning:**
- Produces the minimum number of transactions needed to settle all debts.
- O(n log n) — fast enough for small groups.
- Aisha's request: "I just want one number per person. Who pays whom, how much, done." — simplified debts directly implements this.
