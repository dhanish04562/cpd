# Profit Settlement System - Quick Reference Card

## Status Cheat Sheet

```
PENDING ─── (90 days pass) ──→ ELIGIBLE ─── (click payout) ──→ PAID
   │                              │
   │                              │
   Waiting (cannot pay)        Ready to pay (can click button)
   Created at year-end         Happens automatically
                               After Mar 31 for year 2026
```

---

## Timeline for Year 2026

| Date | Status | Can Pay? | Notes |
|------|--------|----------|-------|
| Dec 31, 2026 | PENDING | ✗ No | Settlement created, 90-day timer starts |
| Jan 15, 2027 | PENDING | ✗ No | Still waiting (75 days left) |
| Mar 30, 2027 | PENDING | ✗ No | Almost there (1 day left) |
| Mar 31, 2027 (11:59 PM) | PENDING | ✗ No | Still waiting (1 second left) |
| Apr 1, 2027 | ELIGIBLE | ✓ YES | Auto-promoted! Ready to execute payout |
| Apr 2, 2027 | ELIGIBLE | ✓ YES | Still ready |
| Apr 3, 2027 (after payout) | PAID | - | Settled, cannot change |

---

## API Behavior at a Glance

### POST /api/profit-settlements/calculate?year=2026
```
Creates: status="pending", payout_eligible_date=Mar 31, 2027
Can pay now?: NO
Next step: Wait 90 days
```

### GET /api/profit-settlements
```
Auto-updates: Runs check_and_update_settlement_eligibility()
Promotes: PENDING → ELIGIBLE if 90 days passed
Status shown: Whatever the current status is
```

### POST /api/profit-settlements/{id}/payout
```
Requires: status must be "ELIGIBLE"
If PENDING: Error 400 "not yet eligible"
If ELIGIBLE: ✓ Payout executes, status→PAID
If PAID: Error 400 "already paid"
```

---

## Frontend Button Status

```
PENDING Status
├─ Button Text: "⏳ 42 days until eligible"
├─ Button: DISABLED (grayed out)
└─ User Action: None (cannot click)

ELIGIBLE Status
├─ Button Text: "Execute Payout"
├─ Button: ENABLED (blue, clickable)
└─ User Action: Click to execute immediately

PAID Status
├─ Button Text: "Paid on Apr 2, 2027"
├─ Button: HIDDEN (gone)
└─ User Action: None (complete)
```

---

## Error Messages You Might See

| Message | Meaning | Solution |
|---------|---------|----------|
| "Settlement not yet eligible (waiting for 90-day delay)" | Status is PENDING, created < 90 days ago | Wait longer, then try again |
| "Settlement already paid" | Status is PAID, already executed | No action needed, it's done |
| "Settlement not found" | Invalid settlement_id | Check the settlement ID |

---

## How the Magic Happens

```
Every API call that touches settlements:

1. API endpoint called
   ↓
2. check_and_update_settlement_eligibility() runs
   ↓
3. Gets current date
   ↓
4. Finds all PENDING settlements
   ↓
5. For each: Is current_date >= payout_eligible_date?
   ↓
6a. If YES → Update status to "ELIGIBLE"
6b. If NO → Leave as "PENDING"
   ↓
7. Return results to user
   ↓
8. User sees updated status!
```

---

## Database Fields You Should Know

```python
YearlyProfitSettlement {
  "id": "unique-id-123",
  
  "investor_id": "inv-001",
  "investor_name": "Raj Kumar",
  
  "settlement_year": 2026,
  "profit_amount": 50000.00,
  
  "calculation_date": "2026-12-31T23:59:59Z",      # When created
  "payout_eligible_date": "2027-03-31T23:59:59Z",  # When can pay
  "payout_date": "2027-04-02T14:23:45Z",           # When actually paid (if paid)
  
  "status": "pending|eligible|paid"                 # Current state
}
```

---

## Testing Commands

### View all settlements
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/profit-settlements
```

### Calculate settlements for 2026
```bash
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/profit-settlements/calculate?year=2026
```

### Execute a payout
```bash
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/profit-settlements/SETTLEMENT_ID/payout
```

### Check stats
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/profit-settlements/stats
```

---

## Remember These Rules

1. **PENDING means**: Cannot pay yet, waiting 90 days
2. **ELIGIBLE means**: Can pay now (90+ days passed)
3. **PAID means**: Done forever, cannot change
4. **Auto-promote happens**: When you call ANY API endpoint after eligible date
5. **First call after eligibility**: Automatically promotes the settlement status
6. **Manual payout needed**: To change ELIGIBLE → PAID (not automatic!)

---

## Common Questions - Answers

**Q: Do I have to manually check every day?**
A: No! Just use the app normally. Auto-check happens on every API call.

**Q: When exactly does it become eligible?**
A: At `payout_eligible_date` timestamp. For 2026, it's `2027-03-31T23:59:59Z`.

**Q: What if I refresh the page?**
A: The page makes an API call. Auto-check runs. Status updates if needed.

**Q: Can I make it eligible sooner?**
A: No. The system prevents early payouts for a reason (audit trail, fund finality).

**Q: What if a settlement is PENDING and today is the eligible date?**
A: Load any settlement page. API call runs auto-check. Immediately becomes ELIGIBLE.

**Q: Can the status go PAID → ELIGIBLE?**
A: No. PAID is final. Cannot reverse or unpay.

---

## Formulas & Math

### The 90-Day Calculation
```
Year End Date = Dec 31 of settlement year
Payout Eligible Date = Year End Date + 90 days
                     = Dec 31 + 90 days
                     = Mar 31 (next year) + 23:59:59 UTC

For Year 2026:
  Year End = 2026-12-31T23:59:59Z
  Eligible = 2027-03-31T23:59:59Z (exactly 90 days later)

For Year 2025:
  Year End = 2025-12-31T23:59:59Z
  Eligible = 2026-03-31T23:59:59Z (exactly 90 days later)
```

### Status Check Logic
```python
if current_datetime >= payout_eligible_date:
    status = "eligible"
else:
    status = "pending"
```

---

## Tracing a Settlement's Life

```
2026-12-31: Settlement Created
  status="pending"
  payout_eligible_date="2027-03-31T23:59:59Z"
  ↓
  
2027-01 to 2027-03-30: Waiting Period
  status="pending" (on every API call check)
  payout_eligible_date not yet reached
  ↓
  
2027-03-31 23:59:59 UTC: Threshold Reached
  status="pending" (changes on NEXT API call)
  ↓
  
2027-04-01: First API Call After Threshold
  check_and_update_settlement_eligibility() runs
  current_date >= payout_eligible_date? YES!
  status="pending" → "eligible" (PROMOTED!)
  ↓
  
2027-04-02: Admin Executes Payout
  POST /api/profit-settlements/{id}/payout
  Validates status="eligible" ✓
  status="eligible" → "paid"
  payout_date="2027-04-02T14:23:45Z"
  ↓
  
2027-04-02 onwards: Settled
  status="paid" (permanent)
  Cannot change or unpay
```

---

## Debugging Checklist

- [ ] Is the settlement in the database? (Check MongoDB)
- [ ] What is the settlement's status? (PENDING/ELIGIBLE/PAID)
- [ ] What is the settlement's payout_eligible_date? (Check database)
- [ ] Is today >= payout_eligible_date? (Check calendar)
- [ ] Did you call an API endpoint after eligible date? (Triggers auto-check)
- [ ] Did the status get auto-promoted? (Check page refresh)
- [ ] Is investor.total_returns updated? (Check after payout)
- [ ] Is pool.available_funds updated? (Check after payout)
- [ ] Is audit log created? (Check audit logs table)
