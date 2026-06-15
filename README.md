# SplitWise — Shared Expense Tracker

A full-featured shared expense tracker built for flatmates. Tracks who paid what, splits bills across members (equal, exact, percentage), handles currency conversion, and provides one-click debt settlement.

## Live Demo

Deployed on Vercel — see assignment submission for URL.

## Features

- **Login / Register** — session-based auth persisted to localStorage
- **Groups** — create groups, add/remove members with join/leave dates
- **Expenses** — add expenses with equal, exact, or percentage splits
- **Multi-currency** — USD/EUR/GBP auto-converted to INR at fixed 2024 rates
- **Balances** — simplified debt view (minimum transactions) + per-person breakdown
- **Settle up** — record settlements, which adjust balances immediately
- **Import CSV** — full anomaly detection, row-by-row review before import, downloadable report

## Tech Stack

- React 18 + TypeScript + Vite 8
- Tailwind CSS v4
- Zustand (state + localStorage persistence)
- React Router v6
- PapaParse (CSV parsing)
- react-hot-toast

## Setup

```bash
git clone <repo>
cd splitwise-app
npm install
npm run dev        # → http://localhost:5173
npm run build      # production build
```

## Demo Accounts

| Name  | Email              | Password    | Notes                        |
|-------|--------------------|-------------|------------------------------|
| Aisha | aisha@flat.com     | password123 | Group admin                  |
| Rohan | rohan@flat.com     | password123 | Active member                |
| Priya | priya@flat.com     | password123 | Active member                |
| Meera | meera@flat.com     | password123 | Left 31 Mar 2024             |
| Sam   | sam@flat.com       | password123 | Joined 15 Apr 2024           |
| Dev   | dev@flat.com       | password123 | Trip participant              |

## Import

1. Go to **Import CSV** in the sidebar
2. Select **The Flat** group
3. Upload `expenses_export.csv`
4. Review all detected anomalies row by row
5. Override any action if needed
6. Click **Confirm Import**
7. Download the report

## AI Used

Claude (via Kiro IDE) — see AI_USAGE.md
