# Profit Settlement System - Confusion Resolution

## Issue #2 & #3: 90-Day Payout Delay and Status Flow

---

## The Complete Timeline

### Real-World Example (Year 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TIMELINE FOR 2026 SETTLEMENTS                     │
└─────────────────────────────────────────────────────────────────────────────┘

Jan 1, 2026          Dec 31, 2026         Jan 31, 2027         Mar 31, 2027
    │                    │                    │                    │
    │                    │                    │                    │
    │                    │                    │                    │
    ▼                    ▼                    ▼                    ▼
┌──────┐          ┌─────────────┐       ┌──────────┐         ┌───────────┐
│  Jan │          │   Year Ends │       │ Day 30   │         │ Day 90 ✓  │
│      │          │  (Dec 31)   │       │          │         │ ELIGIBLE! │
└──────┘          └─────────────┘       └──────────┘         └───────────┘
                        ▲                                          ▲
                        │                                          │
                  Settlements                              Auto-promoted
                  CREATED with                             to ELIGIBLE
                  status="pending"                         (first API call
                                                           on/after this date)
                        │◄─────────── 90 DAYS DELAY ──────────────►│
```

### What Happens in Each Phase

#### Phase 1: Settlement Created (Dec 31, 2026)
```
POST /api/profit-settlements/calculate?year=2026

Creates YearlyProfitSettlement:
{
  "id": "abc123",
  "investor_id": "inv001",
  "investor_name": "Raj Kumar",
  "settlement_year": 2026,
  "profit_amount": 50000.00,
  "calculation_date": "2026-12-31T23:59:59Z",
  "payout_eligible_date": "2027-03-31T23:59:59Z",  ← Year end + 90 days
  "payout_date": null,
  "status": "pending"  ← Cannot execute payout yet!
}
```

#### Phase 2: Auto-Eligibility Check (Jan 1 - Mar 30, 2027)
```
ANY API call like:
- GET /api/profit-settlements
- GET /api/profit-settlements/stats
- POST /api/profit-settlements/{id}/payout

Triggers: check_and_update_settlement_eligibility()

This function checks: Is current_date >= payout_eligible_date?
Answer: NO (we're still within 90 days)
Status remains: "pending"
```

#### Phase 3: Auto-Promotion (Mar 31, 2027 or later)
```
First API call on or after Mar 31, 2027 triggers:
check_and_update_settlement_eligibility()

This function checks: Is current_date >= payout_eligible_date?
Answer: YES! 

Database updates ALL pending settlements with:
  eligible_date <= now

Settlement is NOW:
{
  "status": "eligible"  ← Auto-upgraded! Ready for payout!
}
```

#### Phase 4: Payout Execution (Mar 31, 2027 or later)
```
POST /api/profit-settlements/{settlement_id}/payout

1. Checks eligibility again
2. Validates status="eligible" ✓
3. Updates settlement:
   - status: "eligible" → "paid"
   - payout_date: "2027-03-31T14:23:45Z"
4. Increments investor.total_returns
5. Updates pool.available_funds
```

---

## Status Transition Diagram

```
┌──────────┐                                    ┌──────────┐
│ PENDING  │                                    │ ELIGIBLE │
│          │                                    │          │
│ Created  │────── 90 days pass ───────────────►│          │
│ waiting  │  (auto checked on API call)        │ Ready to │
│ for      │                                    │ payout   │
│ delay    │                                    │          │
└──────────┘                                    └─────┬────┘
                                                      │
                                         User clicks "Pay Out"
                                         (or API call with settlement_id)
                                                      │
                                                      ▼
                                                  ┌────────┐
                                                  │  PAID  │
                                                  │        │
                                                  │ Settled│
                                                  │        │
                                                  └────────┘
```

### Key Rules:

1. **PENDING to ELIGIBLE**: Automatic when 90 days have passed
   - No manual action required
   - Happens on first API call after eligible_date
   - Checked in: `check_and_update_settlement_eligibility()`

2. **ELIGIBLE to PAID**: Manual action required
   - User must click "Pay Out" button
   - Or call: `POST /api/profit-settlements/{settlement_id}/payout`
   - Only eligible settlements can be paid
   - Once paid, cannot be un-paid

3. **What if status is PENDING and you try to payout?**
   - Error 400: "Settlement not yet eligible for payout (waiting for 90-day delay)"
   - You must wait until 90 days have passed

---

## Why the 90-Day Delay?

1. **Ensure transaction finality**: All transactions for that year must be fully settled
2. **Accounting accuracy**: Time to audit and verify profit calculations
3. **Fund availability**: Pool needs time to ensure funds were actually received/distributed
4. **Regulatory compliance**: Many systems require waiting periods for payouts

---

## Implementation Details in Backend

### Function: check_and_update_settlement_eligibility()

```python
async def check_and_update_settlement_eligibility():
    """Check settlements and update their eligibility status"""
    now = get_current_datetime()  # Returns current date/time
    
    # Find all PENDING settlements where eligibility date has passed
    await db.yearly_profit_settlements.update_many(
        {
            "status": "pending",                    # Only pending ones
            "payout_eligible_date": {"$lte": now}   # Date has passed
        },
        {"$set": {"status": "eligible"}}            # Promote to eligible
    )
```

**Called by:** Every endpoint before returning settlement data
- `GET /api/profit-settlements`
- `GET /api/profit-settlements/stats`  
- `POST /api/profit-settlements/{id}/payout`
- `GET /api/profit-settlements/investor/{investor_id}`

**Why?** To ensure settlements are automatically promoted without admin action

---

## Frontend User Experience

### Before 90 Days (Status: PENDING)
```
Settlement #1 - Raj Kumar
Year: 2026
Amount: ₹50,000
Status: ⏳ PENDING
Eligible Date: Mar 31, 2027
Pay Out Button: DISABLED (grayed out)
Message: "Waiting for 90-day delay. Available after Mar 31, 2027"
```

### After 90 Days (Status: ELIGIBLE)
```
Settlement #1 - Raj Kumar  
Year: 2026
Amount: ₹50,000
Status: ✓ ELIGIBLE
Eligible Date: Mar 31, 2027 (past)
Pay Out Button: ENABLED (blue, clickable)
Message: "Ready to payout!"
```

### After Payout (Status: PAID)
```
Settlement #1 - Raj Kumar
Year: 2026
Amount: ₹50,000
Status: ✓ PAID
Eligible Date: Mar 31, 2027
Paid Date: Apr 2, 2027 at 2:15 PM
Pay Out Button: HIDDEN (already paid)
```

---

## Common Questions

### Q1: Can I manually force a settlement to "eligible"?
**A:** No. It must happen automatically after 90 days pass. This prevents accidental early payouts.

### Q2: What if I calculate settlements on Dec 31, 2026 but try to execute payout on Dec 31, 2026?
**A:** Error! Payout eligible date is Mar 31, 2027. You must wait 90 days.

### Q3: What if an investor invested on Jan 1 and we're calculating on Mar 31, 2027?
**A:** That's fine! They invested more than 90 days ago. The 90-day delay applies to THE SETTLEMENT year, not investor tenure.
- Settlement Year: 2026
- Created: Dec 31, 2026
- Eligible: Mar 31, 2027 (90 days later)
- When you can payout: Mar 31, 2027 or later

### Q4: What if I need to test this locally?
**A:** In `backend/server.py` line 23-24, you can set a test date:
```python
# For testing: use this instead of get_current_datetime()
# return datetime(2027, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
```

Uncomment this to simulate date/time in tests.

---

## Verification Checklist

- [ ] Settlements created with correct `payout_eligible_date = year_end + 90 days`
- [ ] Settlements created with `status = "pending"`
- [ ] `check_and_update_settlement_eligibility()` runs on every API call
- [ ] Settlements auto-promoted to "eligible" when date passes
- [ ] Payout button disabled until status changes to "eligible"
- [ ] Payout execution updates status to "paid" and sets payout_date
- [ ] Investor's total_returns incremented on successful payout
- [ ] Pool's available_funds incremented on successful payout

---

## Database Check Commands

```python
# Check all pending settlements
db.yearly_profit_settlements.find({"status": "pending"})

# Check all eligible settlements 
db.yearly_profit_settlements.find({"status": "eligible"})

# Check all paid settlements
db.yearly_profit_settlements.find({"status": "paid"})

# Check a specific investor's settlements
db.yearly_profit_settlements.find({"investor_id": "inv001"})
```
