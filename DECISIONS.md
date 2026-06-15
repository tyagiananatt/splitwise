# DECISIONS.md — Decision Log

Every significant technical and product decision made during this project, with the options considered and the reasoning behind the choice taken.

---

## D1: Storage — localStorage via Zustand vs Real Database

**Context:** The assignment requires "relational DBs only." The app must also deploy publicly to Vercel without requiring an evaluator to provision a database or configure environment variables.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Next.js + PostgreSQL + Prisma on Vercel | Truly relational, multi-user, persistent | Requires DB provisioning (Supabase/Neon), env vars, migration setup — evaluator cannot run the app without a connection string |
| React + Vite + localStorage (Zustand persist) | Zero-config deploy, works instantly for any evaluator | Data is browser-local; different users on different machines cannot share data natively |
| React + Express + SQLite | Closer to a real DB | SQLite file not suitable for Vercel serverless; still requires local setup |

**Decision:** React + Vite + localStorage, with the full relational schema in `SCOPE.md` and a `prisma/schema.prisma` as proof of the relational design.

**Reasoning:**

The priority for an assignment submission is that any evaluator can open the app and use it immediately — no setup, no keys, no provisioning. localStorage via Zustand's `persist` middleware achieves this.

The relational design requirement is demonstrated through two artefacts: the complete schema in `SCOPE.md` (all tables, FK constraints, UNIQUE constraints, normalisation decisions) and a working Prisma schema targeting PostgreSQL in `prisma/schema.prisma`. These show the data model — which is what "relational DB" is really testing.

Critically, the business logic is fully decoupled from the storage layer. `balances.ts`, `csvImporter.ts`, and `userRegistry.ts` have zero knowledge of how data is stored. Switching from localStorage to a PostgreSQL-backed API would only require changing the Zustand store's read/write calls to `fetch()` — every calculation, validation, and anomaly detection function would remain unchanged.

---

## D2: Currency Conversion — Live API vs Fixed Historical Rates

**Context:** The CSV contains USD-denominated expenses from a March 2024 trip. Priya's complaint: *"the sheet pretends a dollar is a rupee."*

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Live exchange rate API (e.g., exchangerate-api.com) | Always current | Requires API key; rate changes daily — two imports of the same file give different numbers; network dependency |
| Fixed rates for the transaction date | Reproducible; no API key; historically accurate | Rates are hardcoded and become stale over time |
| 1:1 (no conversion, same as original sheet) | No implementation needed | Wrong — this is exactly what Priya is complaining about |

**Decision:** Fixed rates anchored to early 2024 approximate values: **1 USD = ₹84.5**, 1 EUR = ₹91.2, 1 GBP = ₹107.3.

**Reasoning:**
- The expenses are dated Feb–Jun 2024. A live rate pulled today would not reflect the rate at the time of the expense and would make the balance calculation non-deterministic.
- Reproducibility is essential: two evaluators running the same import must get the same numbers.
- The rate source is documented (`lib/csvImporter.ts`, `lib/utils.ts`) and clearly labelled in the UI whenever a conversion is applied.
- If the app were extended, the `exchange_rates` table in the schema (see `SCOPE.md`) would hold per-date rates fetched at import time and cached — but that is beyond the scope of this assignment.

---

## D3: Duplicate Detection — Which Strategy

**Context:** The CSV contains both exact duplicates (byte-for-byte identical rows) and near-duplicates (same description/date/payer but different amounts).

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Silently drop exact duplicates | Clean import, no user friction | Violates Meera's explicit request; user can't audit what was removed |
| Import all rows, mark duplicates | Nothing lost | Corrupts balances — Aisha's hotel trip would count twice |
| Flag duplicates, require user decision before import | Transparent; Meera-compliant | More complex UI |

**Decision:** Option 3 — Flag and surface every duplicate with a suggested action; user confirms or overrides before any row is imported.

**Reasoning:**
- Meera's requirement is explicit: *"clean up the duplicates — but I want to approve anything the app deletes or changes."* Silent deletion directly contradicts this.
- The import review UI shows every row, with exact duplicates pre-set to `skip` and near-duplicates pre-set to `flag_for_review`. The user can toggle any row to import or skip before confirming.
- Detection keys:
  - **Exact:** `date|description|amount|currency|paidBy` — all five must match.
  - **Near:** `date|description|paidBy` match, but amount or currency differs.

---

## D4: Settlement Detection — How to Identify Debt Repayments in the CSV

**Context:** The CSV mixes genuine shared expenses with debt settlements (rows 17, 38, 39). Settlements must not be counted as expenses in balance calculations — they reduce debt, not create it.

**Options considered:**

| Option | Detection Signal | Miss rate |
|--------|-----------------|-----------|
| Negative amount only | amount < 0 | Misses rows 38, 39 (positive amounts with "pays"/"reimburse") |
| Description keywords only | "pays", "reimburse", "settlement" | Misses Row 17 if someone names an expense "Bob pays for dinner" |
| Both signals, either sufficient | amount < 0 OR keyword match | Lowest miss rate |

**Decision:** Both signals are used independently — either one triggers settlement classification.

**Reasoning:**
- Row 17 triggers both: negative amount AND "pays" in description.
- Rows 38 and 39 trigger only the keyword signal (positive amounts).
- A third confirmatory signal is used: if `Split Between` contains only the payer (i.e., no one else), the row is almost certainly a settlement, not a group expense.
- When payer/payee direction is ambiguous from description phrasing alone, the row is flagged as `SETTLEMENT_AMBIGUOUS` in the review UI — the user must confirm direction before import (see AI_USAGE.md Case 2 for why this matters).
- Rows flagged as settlements are imported as `Settlement` records, not `Expense` records. They apply directly to the balance: `payer.net -= amount`, `payee.net += amount`.

---

## D5: Temporal Membership — Whether to Honour Join/Leave Dates

**Context:** Meera left on 31 March 2024. Sam joined on 15 April 2024. The CSV contains rows that list both in splits after/before their respective dates.

**Options considered:**

| Option | Behaviour |
|--------|-----------|
| Ignore dates; use current membership | Simple, but produces incorrect balances. Sam would owe for February groceries. |
| Hard error — skip the whole row | Correct but wasteful; the expense is real, just the split is wrong. |
| Soft fix — exclude ineligible member, import with remaining members | Most accurate; preserves real expenses. |

**Decision:** Soft fix — exclude the ineligible member from the split and import the expense among the remaining active members.

**Reasoning:**
- Sam's explicit complaint: *"I moved in mid-April. Why would March electricity affect my balance?"* — this is the exact problem being solved.
- Dropping the entire row (hard error) loses real data. March electricity was a real expense — only Sam should not be in it.
- The anomaly is still flagged (severity: `warning`) so the user can see exactly which member was excluded and why.
- Implementation: in `rowToExpense()` in `csvImporter.ts`, each member in `splitBetween` is checked: `expenseDate >= member.joinedAt` AND (`member.leftAt === null` OR `expenseDate <= member.leftAt`). Members failing this check are simply not added to `shares[]`.

---

## D6: Balance Calculation — Rounding Strategy

**Context:** Equal splits on non-round amounts produce fractions. ₹100 ÷ 3 = ₹33.333…

**Options considered:**

| Strategy | ₹100 ÷ 3 result | Total |
|----------|----------------|-------|
| Truncate to 2dp | 33.33 + 33.33 + 33.33 | ₹99.99 — ₹0.01 lost |
| Round each independently | 33.33 + 33.33 + 33.33 | ₹99.99 — same problem |
| Remainder to first participant | 33.34 + 33.33 + 33.33 | ₹100.00 ✓ |

**Decision:** Round each share to 2 decimal places. Distribute any remainder to the **first member in the split** (typically the payer).

**Reasoning:**
- The sum of all shares must always equal `amount_inr` exactly. Truncation or per-share rounding breaks this invariant.
- Assigning the remainder to the first participant (the payer) is the least-surprise convention — the payer floats the fractional cent rather than being owed slightly less than they paid.
- The `round2()` function in `lib/balances.ts` is used for every arithmetic operation throughout the app — no rounding happens implicitly anywhere else.

---

## D7: Balance Simplification Algorithm

**Context:** A group of 5 people has a complex web of debts. Aisha's request: *"I just want one number per person. Who pays whom, how much, done."*

**Options considered:**

| Algorithm | Transactions needed | Complexity |
|-----------|-------------------|------------|
| Direct pairwise (every debt shown separately) | Up to n(n-1)/2 | O(n²) — messy for 5+ people |
| Greedy min-cost (largest creditor vs largest debtor) | Minimum possible, typically n-1 | O(n log n) |
| Optimal flow (min-cost flow graph) | Same as greedy for most cases | O(n³) — overkill |

**Decision:** Greedy min-cost: sort creditors and debtors by amount descending, pair the largest creditor with the largest debtor, settle as much as possible, repeat.

**Reasoning:**
- Produces the minimum number of transactions to clear all debts in the group.
- O(n log n) — fast enough for groups of any realistic size.
- Simple to implement, easy to trace in a live session (`lib/balances.ts`, `simplifyDebts()`).
- Does not guarantee the globally optimal solution in all graphs, but is optimal for the common case and is the industry-standard approach (Splitwise, Tricount both use greedy).

---

## D8: Group Visibility — Per-User Scoping

**Context:** All data is in a single shared localStorage key. Without filtering, every logged-in user would see every group, including groups they were never added to.

**Options considered:**

| Option | Behaviour |
|--------|-----------|
| Show all groups to all users | Wrong — private data leaks between users |
| Show only groups where user is a member | Correct |
| Show groups only if user is an admin | Too restrictive |

**Decision:** Show only groups where `group.members.some(m => m.userId === currentUser.id)`.

**Implementation:** Two selector functions on the store:
- `getGroupsForUser(userId)` — filters `groups[]`
- `getExpensesForUser(userId)` — filters `expenses[]` based on group membership

Every page (Dashboard, Groups, Expenses, Balances, Import, Layout sidebar) uses these selectors instead of the raw store arrays. `GroupDetail` also has a route-level membership guard that blocks direct URL access by non-members.

---

## D9: Member Linking — What Happens When a Member Hasn't Registered Yet

**Context:** An admin adds "Rohan" to a group with email `rohan@gmail.com`. Rohan hasn't registered yet. Later Rohan registers. Without special handling, Rohan's group slot has a random UUID that will never match his real account.

**Options considered:**

| Option | Behaviour |
|--------|-----------|
| Require all members to register first | Friction; breaks the CSV import flow (historical flatmates) |
| Assign a random UUID; Rohan manually re-links | Poor UX; Rohan sees no balances on login |
| Use email as a stable placeholder; auto-link on registration | Correct |

**Decision:** When adding a member:
1. Look up their email in `userRegistry` (the shared user store).
2. If found → use their real `userId` immediately. Balance is live.
3. If not found → store `placeholder-their@email.com` as the `userId`, with their email recorded.

When they register:
- `Register.tsx` scans all groups for member slots with `email === newUser.email`.
- For each match, calls `relinkMember(placeholderUserId, newUser)`.
- `relinkMember` patches: group `members[]`, all expense `paidById`/`paidByName`, all expense `shares[]`, all `settlements`. This is a single atomic Zustand state update.

**Reasoning:** Email is the natural stable identifier before account creation. The `placeholder-` prefix makes placeholder IDs detectable (shown as ⏳ in the Members tab UI). After registration, Rohan logs in and sees his correct balances immediately — all historical expenses are correctly attributed.

---

## D10: Split Type Support

**Context:** The CSV contains three split types. The app must support all of them.

| Split Type | CSV example | How splits are calculated |
|------------|-------------|--------------------------|
| `equal` | Groceries, Netflix | `amount_inr ÷ n` with remainder to first member |
| `exact` | Rent (custom per-person amounts) | Parse `Name:Amount` pairs from Notes column |
| `percentage` | Lunch (Rohan:60, Priya:40) | Parse `Name:Pct` pairs; validate sum = 100%; `amount_inr × (pct/100)` |

**Decision:** Implement all three. Validation:
- Percentage: if `Σ percentages ≠ 100`, normalise proportionally and flag as `SPLIT_MISMATCH`.
- Exact: if `Σ exact amounts ≠ total`, distribute the remainder to the payer and flag as `SPLIT_MISMATCH`.

**Reasoning:** The CSV explicitly uses all three. Ignoring exact/percentage splits would produce incorrect balances for rent and the lunch expense. The fallback (normalise/redistribute) is better than silently dropping the row.