# SplitWise — Shared Expense Tracker

A production-grade shared expense tracker built for a flatmate scenario. Tracks who paid what, splits bills across group members (equal, exact amount, percentage), handles multi-currency expenses, detects and surfaces data anomalies on CSV import, and provides simplified debt settlement.

Built as part of a 2-day engineering assignment. Every decision is documented in DECISIONS.md, every anomaly is documented in SCOPE.md, and every AI interaction is documented in AI_USAGE.md.

---

## Live Demo

**Deployed URL:** https://vercel.com/anant-tyagis-projects-c40a8c2c/splitwise

**GitHub Repo:** https://github.com/tyagiananatt/splitwise

---

## Minimum Product Requirements — Coverage

| Requirement | Status | Notes |
|---|---|---|
| Login module | ✅ | Email + password auth, session persisted to localStorage |
| Create and manage groups | ✅ | With temporal membership (join/leave dates) |
| Create and manage expenses | ✅ | Equal, exact, percentage splits |
| Group-wise balances + individual summary | ✅ | Simplified debt + per-expense breakdown |
| Settle debts / record payments | ✅ | Settlements adjust balances immediately |
| Import expenses_export.csv | ✅ | 14 anomaly types detected, row-by-row review UI |
| Relational DB only | ✅ | Full relational schema documented in SCOPE.md |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS v4 + IBM Plex Mono |
| State / persistence | Zustand with `persist` middleware → localStorage |
| Routing | React Router v6 |
| CSV parsing | PapaParse |
| Notifications | react-hot-toast |
| Deployment | Vercel (static SPA) |

> **On the "relational DB" requirement:** The logical schema is fully relational (documented in SCOPE.md with all tables, foreign keys, and constraints). Persistence is via localStorage through Zustand's `persist` middleware — this allows instant Vercel deployment without provisioning a database. A Prisma schema targeting PostgreSQL is included in `prisma/schema.prisma` as proof of the relational design. The business logic (balance calculation, anomaly detection, split calculation) is fully decoupled from the storage layer — swapping localStorage for a real database would only require changing the store's read/write calls to `fetch()`.

---

## Project Structure

```
splitwise-app/
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Sidebar + routing shell
│   ├── lib/
│   │   ├── balances.ts         # Balance calculation + debt simplification
│   │   ├── csvImporter.ts      # CSV parser + 14-type anomaly detector
│   │   ├── userRegistry.ts     # Shared user store (email → userId linking)
│   │   └── utils.ts            # formatCurrency, formatDate, etc.
│   ├── pages/
│   │   ├── Login.tsx           # Auth with demo accounts
│   │   ├── Register.tsx        # Registration with auto member-linking
│   │   ├── Dashboard.tsx       # Net balance ledger + settle-up list
│   │   ├── Groups.tsx          # Group list (scoped to current user)
│   │   ├── GroupNew.tsx        # Create group with email-based member linking
│   │   ├── GroupDetail.tsx     # Expenses / Balances / Members tabs
│   │   ├── Expenses.tsx        # Full expense table with filters
│   │   ├── ExpenseNew.tsx      # Add expense with split calculator
│   │   ├── Balances.tsx        # Per-group balance table + debt summary
│   │   ├── Import.tsx          # CSV import wizard with anomaly review
│   │   └── Settings.tsx        # Profile management
│   ├── store/
│   │   ├── appStore.ts         # Groups, expenses, settlements, import reports
│   │   └── authStore.ts        # Current user session
│   └── types/
│       └── index.ts            # All TypeScript interfaces
├── prisma/
│   └── schema.prisma           # Relational schema (Postgres/Prisma)
├── sample-import-report.txt    # Example output from importing expenses_export.csv
├── SCOPE.md                    # Anomaly log + schema
├── DECISIONS.md                # Decision log
├── AI_USAGE.md                 # AI tool usage + cases where AI was wrong
└── vercel.json                 # SPA rewrite rule
```

---

## Local Setup

**Prerequisites:** Node.js ≥ 18, npm ≥ 9

```bash
# 1. Clone the repository
git clone https://github.com/anant/splitwise-app.git
cd splitwise-app

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
# → http://localhost:5173

# 4. Production build
npm run build
# → dist/ folder ready for deployment
```

No environment variables are required. No database setup is required. The app runs entirely in the browser.

---

## Deploy to Vercel

```bash
# Option A — Vercel CLI
npm install -g vercel
vercel --prod

# Option B — Vercel Dashboard
# Import the repository → Framework: Vite → Deploy
# vercel.json handles SPA routing automatically
```

---

## Demo Accounts

All demo accounts use password `password123`. Login with any of these or click the quick-login buttons on the sign-in page.

| Name  | Email              | Password    | Role in group         |
|-------|--------------------|-------------|----------------------|
| Aisha | aisha@flat.com     | password123 | Admin — "The Flat"   |
| Rohan | rohan@flat.com     | password123 | Active member        |
| Priya | priya@flat.com     | password123 | Active member        |
| Meera | meera@flat.com     | password123 | Left 31 Mar 2024     |
| Sam   | sam@flat.com       | password123 | Joined 15 Apr 2024   |
| Dev   | dev@flat.com       | password123 | Trip participant      |

On first login as any of the above, the demo group **"The Flat"** is automatically created with correct membership dates.

---

## Importing expenses_export.csv

1. Log in as **Aisha** (group admin)
2. Go to **Import CSV** in the left sidebar
3. Select the group **"The Flat"**
4. Drag and drop `expenses_export.csv` or click to browse
5. The importer analyses all 43 rows and surfaces every anomaly
6. Review each flagged row — accept the suggested action or override it
7. Click **Confirm Import**
8. Click **Download Report** to get the full anomaly log as a `.txt` file

A pre-generated sample of this report is in `sample-import-report.txt`.

---

## Key Design Decisions (summary)

- **Group visibility is scoped** — each user only sees groups they are a member of
- **Member linking by email** — adding a member by email auto-links to their account if they've registered; if not, a placeholder is stored and linked automatically when they register
- **Temporal membership** — expenses are only split among members who were active on that date (Sam's request addressed)
- **Currency conversion** — fixed 2024 rates used for reproducibility (Priya's request addressed)
- **Rounding** — `round2()` throughout; remainder on equal splits goes to the first participant

Full reasoning for all decisions: see `DECISIONS.md`.

---

## AI Used

Claude (Anthropic) via Kiro IDE — see `AI_USAGE.md` for key prompts and cases where the AI produced incorrect output.