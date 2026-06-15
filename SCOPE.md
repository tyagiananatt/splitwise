# SCOPE.md — Anomaly Log & Database Schema

## Database Schema

Since this is a client-side React app (no backend), data is persisted in `localStorage` via Zustand's `persist` middleware. The logical schema mirrors a relational model:

### `users`
| Column    | Type    | Notes                          |
|-----------|---------|-------------------------------|
| id        | string  | cuid / uuid                   |
| name      | string  |                               |
| email     | string  | unique                        |
| password  | string  | plaintext in demo (no backend)|
| createdAt | string  | ISO datetime                  |

### `groups`
| Column      | Type   | Notes                    |
|-------------|--------|--------------------------|
| id          | string | uuid                     |
| name        | string |                          |
| description | string | optional                 |
| currency    | string | default INR              |
| members     | JSON   | embedded GroupMember[]   |
| createdAt   | string |                          |
| updatedAt   | string |                          |

### `group_members` (embedded in groups)
| Column   | Type   | Notes                              |
|----------|--------|------------------------------------|
| userId   | string | references users.id                |
| name     | string | denormalized for display           |
| email    | string |                                    |
| joinedAt | string | ISO datetime                       |
| leftAt   | string | null if still active               |
| role     | string | "admin" or "member"                |

### `expenses`
| Column       | Type    | Notes                                |
|--------------|---------|--------------------------------------|
| id           | string  | uuid                                 |
| groupId      | string  | references groups.id                 |
| description  | string  |                                      |
| amount       | number  | original amount in original currency |
| currency     | string  | e.g., INR, USD                       |
| amountInr    | number  | converted to INR                     |
| exchangeRate | number  | rate used                            |
| paidById     | string  | references users.id                  |
| paidByName   | string  | denormalized                         |
| splitType    | string  | "equal" \| "exact" \| "percentage"   |
| shares       | JSON    | ExpenseShare[]                       |
| date         | string  | ISO date                             |
| notes        | string  | optional                             |
| isSettlement | boolean | true if this is a settlement record  |
| importRowNum | number  | original CSV row number              |
| createdAt    | string  |                                      |

### `expense_shares` (embedded in expenses)
| Column      | Type   | Notes              |
|-------------|--------|--------------------|
| userId      | string |                    |
| userName    | string | denormalized       |
| shareAmount | number | in INR             |
| percentage  | number | for % splits       |
| isExact     | bool   | for exact splits   |

### `settlements`
| Column    | Type   | Notes                |
|-----------|--------|----------------------|
| id        | string |                      |
| groupId   | string |                      |
| payerId   | string |                      |
| payerName | string |                      |
| payeeId   | string |                      |
| payeeName | string |                      |
| amount    | number | in INR               |
| currency  | string |                      |
| date      | string |                      |
| notes     | string |                      |
| createdAt | string |                      |

### `import_reports`
| Column      | Type   | Notes                                       |
|-------------|--------|---------------------------------------------|
| id          | string |                                             |
| filename    | string |                                             |
| totalRows   | number |                                             |
| importedRows| number |                                             |
| skippedRows | number |                                             |
| anomalies   | JSON   | ImportAnomaly[]                             |
| parsedRows  | JSON   | ImportRow[]                                 |
| status      | string | "pending_review" \| "completed"             |
| createdAt   | string |                                             |
| groupId     | string |                                             |

---

## Anomaly Log — expenses_export.csv

All 12+ deliberate data problems found and their handling policy:

### 1. EXACT_DUPLICATE — Row 33 vs Row 13
- **Row 13:** `2024-03-20 | Trip to Goa - Hotel | 8500 | INR | Aisha`
- **Row 33:** Identical
- **Detection:** Exact key match (date + description + amount + currency + payer)
- **Policy:** Skip the later row. Meera must approve. Flagged in review UI.

### 2. EXACT_DUPLICATE — Row 35 vs Row 14
- **Row 14:** `2024-02-14 | Dinner out | 2400 | INR | Aisha`
- **Row 35:** Identical ("Exact duplicate of valentines dinner")
- **Policy:** Skip the later row.

### 3. EXACT_DUPLICATE — Row 41 vs Row 9 (March electricity)
- **Row 9:** `2024-03-05 | Electricity Bill | 950 | INR | Aisha`
- **Row 41:** Identical description+date but notes say "Duplicate March electricity"
- **Policy:** Skip the later row.

### 4. EXACT_DUPLICATE — Row 44 vs Row 23 (Trip activities)
- **Row 23:** `2024-03-22 | Trip to Goa - Activities | 4500 | USD | Priya`
- **Row 44:** Identical
- **Policy:** Skip the later row.

### 5. NEAR_DUPLICATE — Row 14 vs Row 9 (different bills)
- **Row 9:** `2024-03-10 | Dinner out | 2400 | INR | Aisha | "Valentines dinner"`
- **Row 14:** Same date+description, but this was the March dinner out
- **Policy:** Flag for review. Different months so both may be legitimate; user decides.

### 6. NEAR_DUPLICATE — Rows 19 and 34 (April electricity)
- **Row 19:** `2024-04-01 | Electricity Bill | 870 | INR | Rohan`
- **Row 34:** `2024-04-01 | Electricity Bill | 900 | INR | Rohan`
- **Detection:** Same date + description + payer, different amounts
- **Policy:** Near-duplicate — flag for review. Could be different readings or a correction. User picks one.

### 7. FOREIGN_CURRENCY — Row 12, 15, 23
- **Row 12:** `Trip to Goa - Hotel | 8500 | USD` — treated as ₹8500 in original sheet = WRONG
- **Row 15:** `Trip to Goa - Activities | 4500 | USD | Priya`
- **Policy:** Convert using fixed 2024 rate: 1 USD = ₹84.5. Rohan's complaint ("the sheet pretends a dollar is a rupee") is addressed.

### 8. SETTLEMENT_AS_EXPENSE — Row 17
- **Row 17:** `2024-03-28 | Meera pays Aisha | -500 | INR | Meera`
- **Detection:** Description contains "pays" + negative amount
- **Policy:** Import as settlement (not a shared expense). Negative amount confirms it.

### 9. SETTLEMENT_AS_EXPENSE — Row 38
- **Row 38:** `2024-02-28 | Rohan pays Priya | 300 | INR | Rohan`
- **Detection:** "pays" in description, single-person split
- **Policy:** Import as settlement.

### 10. SETTLEMENT_AS_EXPENSE — Row 40
- **Row 40:** `2024-04-30 | Sam reimburses Rohan | 200 | INR | Sam`
- **Detection:** "reimburse" in description
- **Policy:** Import as settlement.

### 11. NEGATIVE_AMOUNT — Row 17
- **Amount:** -500
- **Policy:** Negative amounts = settlement/refund. Import as settlement.

### 12. EXPENSE_AFTER_MEMBER_LEFT — Multiple rows
- **Meera** left 2024-03-31. Any expense dated April+ that includes Meera in split is flagged.
- **Sam** joined 2024-04-15. Any expense before that date that includes Sam is flagged.
- **Detection:** Member's joinedAt/leftAt is checked against expense date
- **Policy:** Silently exclude the ineligible member from the split (they were not in the flat). Sam's complaint ("why would March electricity affect my balance") is addressed.

### 13. SPLIT_MISMATCH — Row 37 (percentage)
- Percentage split entries where proportions are specified in Notes
- If total ≠ 100%, normalize proportionally

### 14. SPLIT_MISMATCH — Row 38 (exact)
- Exact amounts in Notes that don't sum to expense total
- Remainder distributed to payer
