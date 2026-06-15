# SCOPE.md — Anomaly Log & Database Schema

---

## Part 1: Database Schema

The logical data model is fully relational. Persistence in this deployment uses localStorage via Zustand's `persist` middleware. The equivalent PostgreSQL schema is in `prisma/schema.prisma`.

### Entity Relationship Summary

```
users ──< group_members >── groups
groups ──< expenses
expenses ──< expense_shares
users ──< expense_shares
groups ──< settlements
users ──< settlements (as payer and payee)
groups ──< import_reports
```

---

### Table: `users`

| Column     | Type        | Constraints          | Notes                                   |
|------------|-------------|----------------------|-----------------------------------------|
| id         | VARCHAR(36) | PRIMARY KEY          | UUID v4                                 |
| name       | VARCHAR(100)| NOT NULL             |                                         |
| email      | VARCHAR(255)| NOT NULL, UNIQUE     | Case-insensitive lookup                 |
| password   | VARCHAR(255)| NOT NULL             | Hashed in production; plaintext in demo |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW|                                         |

---

### Table: `groups`

| Column      | Type        | Constraints           | Notes                      |
|-------------|-------------|------------------------|----------------------------|
| id          | VARCHAR(36) | PRIMARY KEY            | UUID v4                    |
| name        | VARCHAR(100)| NOT NULL               |                            |
| description | TEXT        | NULLABLE               |                            |
| currency    | VARCHAR(3)  | NOT NULL, DEFAULT 'INR'| Group's base currency      |
| created_at  | TIMESTAMPTZ | NOT NULL, DEFAULT NOW  |                            |
| updated_at  | TIMESTAMPTZ | NOT NULL               | Updated on every mutation  |

---

### Table: `group_members`

| Column    | Type        | Constraints                         | Notes                                  |
|-----------|-------------|--------------------------------------|----------------------------------------|
| id        | VARCHAR(36) | PRIMARY KEY                          |                                        |
| group_id  | VARCHAR(36) | NOT NULL, FK → groups.id ON DELETE CASCADE |                              |
| user_id   | VARCHAR(36) | NOT NULL, FK → users.id ON DELETE CASCADE  |                              |
| name      | VARCHAR(100)| NOT NULL                             | Denormalised for display speed         |
| email     | VARCHAR(255)| NOT NULL                             | Used for account-linking on registration|
| joined_at | TIMESTAMPTZ | NOT NULL                             | Date member joined the group           |
| left_at   | TIMESTAMPTZ | NULLABLE                             | NULL = still active                    |
| role      | VARCHAR(20) | NOT NULL, DEFAULT 'member'           | 'admin' or 'member'                    |
| UNIQUE    |             | (group_id, user_id)                  | One slot per user per group            |

**Key design note:** `email` is stored on the member record (not just on users) so that placeholder members — people added before they register — can be linked to their real account when they sign up. See `DECISIONS.md D9`.

---

### Table: `expenses`

| Column        | Type           | Constraints                               | Notes                                      |
|---------------|----------------|--------------------------------------------|--------------------------------------------|
| id            | VARCHAR(36)    | PRIMARY KEY                                | UUID v4                                    |
| group_id      | VARCHAR(36)    | NOT NULL, FK → groups.id ON DELETE CASCADE |                                            |
| description   | VARCHAR(255)   | NOT NULL                                   |                                            |
| amount        | DECIMAL(10,2)  | NOT NULL                                   | Original amount in `currency`              |
| currency      | VARCHAR(3)     | NOT NULL, DEFAULT 'INR'                    | Original currency of the transaction       |
| amount_inr    | DECIMAL(10,2)  | NOT NULL                                   | Converted to INR using `exchange_rate`     |
| exchange_rate | DECIMAL(10,4)  | NULLABLE                                   | 1.0 for INR; 84.5 for USD etc.             |
| paid_by_id    | VARCHAR(36)    | NOT NULL, FK → users.id                    |                                            |
| paid_by_name  | VARCHAR(100)   | NOT NULL                                   | Denormalised for display                   |
| split_type    | VARCHAR(20)    | NOT NULL                                   | 'equal', 'exact', or 'percentage'          |
| date          | DATE           | NOT NULL                                   | Date of the actual transaction             |
| notes         | TEXT           | NULLABLE                                   |                                            |
| is_settlement | BOOLEAN        | NOT NULL, DEFAULT FALSE                    | TRUE = debt repayment, not a shared cost   |
| import_row_num| INTEGER        | NULLABLE                                   | Original CSV row number for traceability   |
| created_at    | TIMESTAMPTZ    | NOT NULL, DEFAULT NOW                      |                                            |

---

### Table: `expense_shares`

| Column       | Type          | Constraints                                    | Notes                                 |
|--------------|---------------|------------------------------------------------|---------------------------------------|
| id           | VARCHAR(36)   | PRIMARY KEY                                    |                                       |
| expense_id   | VARCHAR(36)   | NOT NULL, FK → expenses.id ON DELETE CASCADE   |                                       |
| user_id      | VARCHAR(36)   | NOT NULL, FK → users.id                        |                                       |
| user_name    | VARCHAR(100)  | NOT NULL                                       | Denormalised                          |
| share_amount | DECIMAL(10,2) | NOT NULL                                       | This user's portion in INR            |
| percentage   | DECIMAL(5,2)  | NULLABLE                                       | Set for percentage splits             |
| is_exact     | BOOLEAN       | NOT NULL, DEFAULT FALSE                        | TRUE for exact-amount splits          |
| UNIQUE       |               | (expense_id, user_id)                          | One share per user per expense        |

---

### Table: `settlements`

| Column     | Type          | Constraints                               | Notes                                    |
|------------|---------------|--------------------------------------------|-----------------------------------------|
| id         | VARCHAR(36)   | PRIMARY KEY                                |                                         |
| group_id   | VARCHAR(36)   | NOT NULL, FK → groups.id ON DELETE CASCADE |                                         |
| payer_id   | VARCHAR(36)   | NOT NULL, FK → users.id                    | Person paying the debt                  |
| payer_name | VARCHAR(100)  | NOT NULL                                   | Denormalised                            |
| payee_id   | VARCHAR(36)   | NOT NULL, FK → users.id                    | Person receiving the payment            |
| payee_name | VARCHAR(100)  | NOT NULL                                   | Denormalised                            |
| amount     | DECIMAL(10,2) | NOT NULL, CHECK (amount > 0)               | Always positive                         |
| currency   | VARCHAR(3)    | NOT NULL, DEFAULT 'INR'                    |                                         |
| date       | DATE          | NOT NULL                                   |                                         |
| notes      | TEXT          | NULLABLE                                   |                                         |
| created_at | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW                      |                                         |

---

### Table: `import_reports`

| Column        | Type        | Constraints                               | Notes                                          |
|---------------|-------------|-------------------------------------------|------------------------------------------------|
| id            | VARCHAR(36) | PRIMARY KEY                               | UUID v4; also used as `batch_id`               |
| group_id      | VARCHAR(36) | NOT NULL, FK → groups.id ON DELETE CASCADE|                                                |
| triggered_by  | VARCHAR(36) | NOT NULL, FK → users.id                   | Who ran the import                             |
| filename      | VARCHAR(255)| NOT NULL                                  |                                                |
| status        | VARCHAR(20) | NOT NULL                                  | 'pending_review', 'completed', 'rejected'      |
| total_rows    | INTEGER     | NOT NULL                                  |                                                |
| imported_rows | INTEGER     | NOT NULL, DEFAULT 0                       |                                                |
| skipped_rows  | INTEGER     | NOT NULL, DEFAULT 0                       |                                                |
| anomalies     | JSONB       | NOT NULL                                  | Array of ImportAnomaly objects                 |
| parsed_rows   | JSONB       | NOT NULL                                  | Full row-by-row result including user decisions|
| created_at    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW                     |                                                |
| completed_at  | TIMESTAMPTZ | NULLABLE                                  |                                                |

---

### Table: `exchange_rates` *(reference table)*

| Column        | Type          | Constraints                | Notes                                |
|---------------|---------------|----------------------------|--------------------------------------|
| id            | VARCHAR(36)   | PRIMARY KEY                |                                      |
| from_currency | VARCHAR(3)    | NOT NULL                   |                                      |
| to_currency   | VARCHAR(3)    | NOT NULL                   | Always 'INR' in this app             |
| rate          | DECIMAL(10,4) | NOT NULL                   | How many INR per 1 unit of from      |
| effective_date| DATE          | NOT NULL                   | Rate valid from this date            |
| UNIQUE        |               | (from_currency, to_currency, effective_date) |                         |

*Populated with fixed 2024 rates: USD→INR: 84.5, EUR→INR: 91.2, GBP→INR: 107.3*

---

## Part 2: CSV Anomaly Log — expenses_export.csv

The file has 43 data rows (excluding the header). The importer found **14 distinct anomaly types** across **16 affected rows**. Below is the complete log, in CSV row order.

---

### Anomaly 1 — SETTLEMENT_AS_EXPENSE + NEGATIVE_AMOUNT
**Row:** 17  
**Raw data:** `2024-03-28 | Meera pays Aisha | -500 | INR | Meera | Meera | equal | Settlement payment`

**Problems detected:**
- Amount is **negative (−500)**. Normal expenses cannot be negative.
- Description contains **"pays"** — a keyword that signals debt repayment, not a shared cost.
- `Split Between` lists only `Meera` — the payer splitting with themselves confirms this is not a group expense.

**Policy applied:** Import as a **Settlement** record, not an expense. Negative amount is converted to positive (500). This correctly reduces Meera's debt to Aisha in the balance calculation. Flagged in the review UI with severity `warning`.

---

### Anomaly 2 — SETTLEMENT_AS_EXPENSE
**Row:** 38  
**Raw data:** `2024-02-28 | Rohan pays Priya | 300 | INR | Rohan | Rohan | equal | Partial settlement`

**Problems detected:**
- Description contains **"pays"**.
- Split is only `Rohan` — payer paying themselves.

**Policy applied:** Import as a **Settlement** (Rohan → Priya, ₹300). Flagged with severity `warning`.

---

### Anomaly 3 — SETTLEMENT_AS_EXPENSE
**Row:** 39  
**Raw data:** `2024-04-30 | Sam reimburses Rohan | 200 | INR | Sam | Sam | equal | Settlement`

**Problems detected:**
- Description contains **"reimburses"**.
- Split is only `Sam`.

**Policy applied:** Import as a **Settlement** (Sam → Rohan, ₹200). Flagged with severity `warning`.

---

### Anomaly 4 — FOREIGN_CURRENCY (USD, no conversion)
**Row:** 12  
**Raw data:** `2024-03-20 | Trip to Goa - Hotel | 8500 | USD | Aisha | Aisha,Rohan,Priya,Meera | equal | Paid in USD`

**Problem detected:**
- Currency is **USD** but the original spreadsheet treated this as ₹8500. Actual value: **₹718,250** at 2024 rates (1 USD = ₹84.5).
- This directly addresses Priya's complaint: *"the sheet pretends a dollar is a rupee."*

**Policy applied:** Convert USD → INR at fixed rate ₹84.5 per USD. `amount_inr = 8500 × 84.5 = ₹718,250`. Original USD amount preserved. Rate and conversion noted on the expense. Flagged with severity `warning`.

---

### Anomaly 5 — FOREIGN_CURRENCY (USD, no conversion)
**Row:** 15  
**Raw data:** `2024-03-22 | Trip to Goa - Activities | 4500 | USD | Priya | Aisha,Rohan,Priya,Meera | equal`

**Problem detected:** Same as above — USD amount with no conversion.

**Policy applied:** Convert at ₹84.5. `amount_inr = 4500 × 84.5 = ₹380,250`. Flagged with severity `warning`.

---

### Anomaly 6 — NEAR_DUPLICATE (same description, same date, different amount and currency)
**Rows:** 12 and 13  
**Row 12:** `2024-03-20 | Trip to Goa - Hotel | 8500 | USD | Aisha`  
**Row 13:** `2024-03-20 | Trip to Goa - Hotel | 8500 | INR | Aisha`

**Problem detected:**
- Same date, description, payer. Row 12 is USD, Row 13 is INR.
- This appears to be the **same expense logged twice** — once in the original currency (USD) and once erroneously as INR (the spreadsheet mistake).

**Policy applied:** Flag both as a near-duplicate pair. Suggested action for Row 13: **Skip** (it's the INR re-entry of the USD expense). User must confirm. Flagged with severity `warning`.

---

### Anomaly 7 — EXACT_DUPLICATE
**Rows:** 13 and 32  
**Data:** `2024-03-20 | Trip to Goa - Hotel | 8500 | INR | Aisha` (identical in both rows)  
**Notes on Row 32:** "Exact duplicate"

**Problem detected:** Byte-for-byte identical row. Exact key match: date + description + amount + currency + payer.

**Policy applied:** **Skip Row 32**. Only Row 13 is imported. Flagged with severity `error`. Meera's rule: flagged for user approval before deletion.

---

### Anomaly 8 — EXACT_DUPLICATE
**Rows:** 4 and 34  
**Data:** `2024-02-14 | Dinner out | 2400 | INR | Aisha` (identical)  
**Notes on Row 34:** "Exact duplicate of valentines dinner"

**Policy applied:** **Skip Row 34**. Flagged with severity `error`.

---

### Anomaly 9 — EXACT_DUPLICATE
**Rows:** 8 and 40  
**Data:** `2024-03-05 | Electricity Bill | 950 | INR | Aisha` (identical)  
**Notes on Row 40:** "Duplicate March electricity"

**Policy applied:** **Skip Row 40**. Flagged with severity `error`.

---

### Anomaly 10 — EXACT_DUPLICATE
**Rows:** 15 and 43  
**Data:** `2024-03-22 | Trip to Goa - Activities | 4500 | USD | Priya` (identical)  
**Notes on Row 43:** "Exact duplicate activities"

**Policy applied:** **Skip Row 43**. Flagged with severity `error`.

---

### Anomaly 11 — NEAR_DUPLICATE (same date/description/payer, different amount)
**Rows:** 19 and 33  
**Row 19:** `2024-04-01 | Electricity Bill | 870 | INR | Rohan`  
**Row 33:** `2024-04-01 | Electricity Bill | 900 | INR | Rohan`  
**Notes on Row 26 (Apr 28):** "Duplicate entry" *(separate but related)*

**Problem detected:** Same date, description, payer; amounts differ by ₹30. Could be a corrected reading or two different bills logged on the same day.

**Policy applied:** Flag both as a **near-duplicate pair** with severity `warning`. User chooses: keep both, keep Row 19 (₹870), or keep Row 33 (₹900). Default suggestion: keep first (Row 19), skip Row 33.

---

### Anomaly 12 — EXPENSE_AFTER_MEMBER_LEFT (Meera)
**Affected rows:** All April–June rows that list Meera in `Split Between`  
**Example:** Row 19 `2024-04-01 | Electricity Bill | Aisha,Rohan,Priya,Sam` — Meera is not in this split, but several earlier draft rows had her.

**Problem detected:** Meera's `left_at = 2024-03-31`. Any expense dated **2024-04-01 or later** that includes Meera in the split is invalid — she had left the flat.

**Policy applied:** Meera is **silently excluded** from the split on those rows. The expense is still imported; the remaining active members split it. The anomaly is flagged as `warning` with the note "member excluded from split due to departure date."

---

### Anomaly 13 — EXPENSE_BEFORE_MEMBER_JOINED (Sam)
**Affected rows:** Any row dated before 2024-04-15 that lists Sam  
**Sam's `joined_at = 2024-04-15`**

**Problem detected:** Sam joined 15 April. Any expense before that date that includes Sam is an error. This directly addresses Sam's complaint: *"I moved in mid-April. Why would March electricity affect my balance?"*

**Policy applied:** Sam is **excluded from the split** on any expense dated before 2024-04-15. Flagged as `warning`.

---

### Anomaly 14 — SPLIT_TYPE: EXACT — shares may not sum to total
**Row:** 35  
**Raw data:** `2024-03-31 | Rent | 15000 | INR | Aisha | exact | Aisha:5000,Rohan:4000,Priya:3500,Meera:2500`

**Verification:** 5000 + 4000 + 3500 + 2500 = **15000** ✓ (sums correctly)

**Policy applied:** Import as exact split. No anomaly — verified clean. Row imported normally.

---

### Anomaly 15 — SPLIT_TYPE: PERCENTAGE
**Row:** 36  
**Raw data:** `2024-04-15 | Lunch | 850 | INR | Rohan | percentage | Rohan:60,Priya:40`

**Verification:** 60 + 40 = **100%** ✓

**Policy applied:** Rohan: ₹510 (60%), Priya: ₹340 (40%). Clean import.

---

### Anomaly 16 — SPLIT_TYPE: EXACT — custom dinner
**Row:** 37  
**Raw data:** `2024-05-01 | Custom split dinner | 3000 | INR | Priya | exact | Aisha:1000,Rohan:800,Priya:700,Sam:500`

**Verification:** 1000 + 800 + 700 + 500 = **3000** ✓

**Policy applied:** Clean import with exact shares.

---

## Summary Table

| # | Row(s) | Anomaly Type | Severity | Action Taken |
|---|--------|-------------|----------|--------------|
| 1 | 17 | SETTLEMENT_AS_EXPENSE + NEGATIVE_AMOUNT | warning | Imported as settlement |
| 2 | 38 | SETTLEMENT_AS_EXPENSE | warning | Imported as settlement |
| 3 | 39 | SETTLEMENT_AS_EXPENSE | warning | Imported as settlement |
| 4 | 12 | FOREIGN_CURRENCY (USD) | warning | Converted at ₹84.5/USD |
| 5 | 15 | FOREIGN_CURRENCY (USD) | warning | Converted at ₹84.5/USD |
| 6 | 12+13 | NEAR_DUPLICATE (USD/INR same expense) | warning | Skip Row 13 (INR re-entry) |
| 7 | 13+32 | EXACT_DUPLICATE | error | Skip Row 32 |
| 8 | 4+34 | EXACT_DUPLICATE | error | Skip Row 34 |
| 9 | 8+40 | EXACT_DUPLICATE | error | Skip Row 40 |
| 10 | 15+43 | EXACT_DUPLICATE | error | Skip Row 43 |
| 11 | 19+33 | NEAR_DUPLICATE (same bill, diff amount) | warning | Skip Row 33 (user confirms) |
| 12 | Multiple | EXPENSE_AFTER_MEMBER_LEFT (Meera) | warning | Meera excluded from split |
| 13 | Multiple | EXPENSE_BEFORE_MEMBER_JOINED (Sam) | warning | Sam excluded from split |
| 14 | 35,36,37 | SPLIT_TYPE validation | info | Verified clean, imported |
