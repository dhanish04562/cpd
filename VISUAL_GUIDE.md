# Yearly Profit Settlement System - Visual Guide

## 1. System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    YEARLY PROFIT SETTLEMENT SYSTEM                │
│                        (90-Day Delay Implementation)              │
└─────────────────────────────────────────────────────────────────┘

                          Investment Timeline
                          
Jan 1, 2026           Dec 31, 2026          Mar 31, 2027         Apr 5, 2027
    │                     │                     │                    │
    ▼                     ▼                     ▼                    ▼
┌─────────────┐      ┌──────────────┐    ┌─────────────────┐  ┌────────────┐
│ Investment  │      │  Year Ends   │    │ 90-Day Delay    │  │ Payout     │
│ Starts      │      │  Settlement  │    │ Complete        │  │ Eligible   │
│             │      │  Created     │    │ Auto-Upgrade    │  │ Executed   │
│ Status:     │      │              │    │ to Eligible     │  │            │
│ n/a         │      │ Status:      │    │                 │  │ Status:    │
│             │      │ pending      │    │ Status:         │  │ paid       │
│             │      │              │    │ eligible        │  │            │
└─────────────┘      └──────────────┘    └─────────────────┘  └────────────┘
      │                                         │                    │
      │                                    Automatic!            Manual Action
      │                                                           (One Click)
      └─────────────────────────────────────────────────────────┘
                    Year 1 Payout Flow (365 + 90 days)
```

## 2. Data Flow During Settlement Calculation

```
CALCULATION PHASE (Jan 10, 2027)

User Action: Click "Calculate Year Settlements" → Select 2026

┌──────────────────────────────────────────┐
│ Backend: calculate_yearly_settlements()  │
└──────────────────────────────────────────┘
         │
         ├─→ Get all active investors
         │   ├─ Investor A: ₹50,000 contribution
         │   ├─ Investor B: ₹50,000 contribution
         │   └─ Investor C: ₹100,000 contribution
         │       Total: ₹200,000
         │
         ├─→ For each investor:
         │
         │   Loop:
         │   ├─→ Find all transactions settled in 2026
         │   │   ├─ Transaction 1: investor_share = ₹3,000
         │   │   ├─ Transaction 2: investor_share = ₹2,000
         │   │   ├─ Transaction 3: investor_share = ₹5,000
         │   │   └─ Total 2026 investor_share = ₹10,000
         │   │
         │   ├─→ Calculate investor's proportion
         │   │   ├─ Investor A: 50,000 / 200,000 = 25%
         │   │   ├─ Investor B: 50,000 / 200,000 = 25%
         │   │   └─ Investor C: 100,000 / 200,000 = 50%
         │   │
         │   ├─→ Calculate profit
         │   │   ├─ Investor A: 10,000 × 0.25 = ₹2,500
         │   │   ├─ Investor B: 10,000 × 0.25 = ₹2,500
         │   │   └─ Investor C: 10,000 × 0.50 = ₹5,000
         │   │
         │   └─→ Create settlement record
         │       ├─ profit_amount: ₹2,500 (or ₹5,000)
         │       ├─ status: pending
         │       ├─ payout_eligible_date: Mar 31, 2027
         │       └─ calculation_date: Jan 10, 2027
         │
         └─→ Store in MongoDB + Create audit logs

Result: 3 settlement records created ✓
```

## 3. Automatic Eligibility Promotion

```
ELIGIBILITY CHECK PHASE (Mar 31, 2027)

Timeline:
Jan 10  ─────────────── Mar 30 ─────────── Mar 31 ──────────── Apr 1
  │                        │                  │                   │
Created                   Still             ELIGIBLE!          ELIGIBLE
Settlement              Checking           (Automatic)          (Visible)
(status: pending)
                           ↓
                      Days until eligible?
                      Dec 31 + 90 = Mar 31
                      
                      Current date: Mar 31 ✓
                      
                           ↓
                    check_and_update_settlement_eligibility()
                           ↓
        Query: status="pending" AND
               payout_eligible_date <= NOW()
                           ↓
                    Update: status="pending" →  "eligible"
                           ↓
                    All settlements now show as "Eligible"
                    
No code needed! No cron jobs! Automatic on every API call!
```

## 4. Settlement Status State Machine

```
                    ┌─────────────┐
                    │   PENDING   │  (created at calculation)
                    │  (90 days)  │
                    └──────┬──────┘
                           │
                      Automatic Update
                   (on any API call)
                           │
                           ▼
                    ┌──────────────┐
                    │   ELIGIBLE   │  (ready for payout)
                    │  (manual ok) │
                    └──────┬───────┘
                           │
                    User clicks "Execute Payout"
                           │
                           ▼
                    ┌──────────────┐
                    │     PAID     │  (completed)
                    │ (no more ops)│
                    └──────────────┘

Transitions:
✓ pending → eligible (automatic, time-based)
✓ eligible → paid (manual, user action)
✗ pending → paid (NOT allowed - must wait 90 days)
✗ Any transition backward (irreversible)
```

## 5. Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│         FRONTEND: React ProfitSettlements.js             │
└─────────────────────────────────────────────────────────┘
           │
           ├─→ Stats Dashboard (4 cards)
           │   ├─ Pending: 3 settlements | ₹50,000
           │   ├─ Eligible: 2 settlements | ₹30,000
           │   ├─ Paid: 5 settlements | ₹100,000
           │   └─ Total: 10 settlements | ₹180,000
           │
           ├─→ Settlement Table (filtered view)
           │   ├─ Columns: Name | Year | Profit | Status | Actions
           │   └─ Status icons: ⏱ pending | ⚠ eligible | ✓ paid
           │
           ├─→ Calculate Modal
           │   └─ Year selector + Submit button
           │
           ├─→ Filters
           │   └─ All | Pending | Eligible | Paid
           │
           └─→ Actions
               ├─ Calculate Year Settlements (button)
               └─ Execute Payout per settlement (button)
               
                    ↓ API Calls
                    
┌─────────────────────────────────────────────────────────┐
│          BACKEND: FastAPI server.py Endpoints           │
└─────────────────────────────────────────────────────────┘
           │
           ├─→ POST /profit-settlements/calculate?year=Y
           │   └─ Returns: {message, count}
           │
           ├─→ GET /profit-settlements
           │   └─ Returns: [YearlyProfitSettlement]
           │
           ├─→ GET /profit-settlements/investor/{id}
           │   └─ Returns: [YearlyProfitSettlement]
           │
           ├─→ POST /profit-settlements/{id}/payout
           │   └─ Returns: {message}
           │
           └─→ GET /profit-settlements/stats
               └─ Returns: {counts, amounts}
               
                    ↓ Database Operations
                    
┌─────────────────────────────────────────────────────────┐
│          MONGODB: Collections & Documents               │
└─────────────────────────────────────────────────────────┘
           │
           ├─→ yearly_profit_settlements (new)
           │   ├─ id, investor_id, investor_name
           │   ├─ settlement_year, profit_amount
           │   ├─ calculation_date
           │   ├─ payout_eligible_date
           │   ├─ payout_date, status
           │   └─ [Index on investor_id + settlement_year]
           │
           ├─→ investors (updated)
           │   └─ total_returns ← incremented on payout
           │
           ├─→ pool (updated)
           │   └─ available_funds ← incremented on payout
           │
           └─→ audit_logs (updated)
               └─ Records all settlement events
```

## 6. Settlement Profit Calculation Formula

```
PROFIT CALCULATION
─────────────────────────────────────────────────────

Given:
• Investor A contribution: CA
• Investor B contribution: CB
• Investor C contribution: CC
• Total contribution: CA + CB + CC = T

• Transaction 1 (settled in 2026): investor_share = IS1
• Transaction 2 (settled in 2026): investor_share = IS2
• Transaction 3 (settled in 2026): investor_share = IS3
• Total 2026 investor_share: S = IS1 + IS2 + IS3

Calculate Investor A's Profit:
─────────────────────────────────────────────────────

Step 1: Calculate proportion
        PA = CA / T

Step 2: Apply to total 2026 profit
        Profit_A = S × PA = S × (CA / T)

Step 3: Repeat for all investors
        Profit_B = S × (CB / T)
        Profit_C = S × (CC / T)

Verification:
        Profit_A + Profit_B + Profit_C = S ✓
        (Each investor's share sums to total)

Example with actual numbers:
─────────────────────────────────────────────────────

Contributions:
• Investor A: ₹50,000
• Investor B: ₹50,000
• Investor C: ₹100,000
• Total: ₹200,000

2026 Transactions:
• TX1: investor_share = ₹3,000
• TX2: investor_share = ₹2,000
• TX3: investor_share = ₹5,000
• Total S: ₹10,000

Calculation:
• PA = 50,000 / 200,000 = 0.25 (25%)
• PB = 50,000 / 200,000 = 0.25 (25%)
• PC = 100,000 / 200,000 = 0.50 (50%)

Results:
• Profit_A = 10,000 × 0.25 = ₹2,500
• Profit_B = 10,000 × 0.25 = ₹2,500
• Profit_C = 10,000 × 0.50 = ₹5,000
• Total: ₹10,000 ✓
```

## 7. Payout Execution Process

```
PAYOUT PHASE (Apr 5, 2027)

User Action: Click "Execute Payout" button

┌──────────────────────────────────────┐
│ Frontend: handleExecutePayout()       │
│ Shows confirmation dialog             │
└────────────────────┬─────────────────┘
                     │
                     ▼ User Confirms
                     
┌──────────────────────────────────────┐
│ API Call: POST /profit-settlements   │
│           /{settlement_id}/payout     │
└────────────────────┬─────────────────┘
                     │
                     ▼
┌──────────────────────────────────────┐
│ Backend: execute_settlement_payout()  │
└────────────────────┬─────────────────┘
                     │
    ├────────────────┼────────────────┤
    │                │                │
    ▼                ▼                ▼
  
Step 1:           Step 2:          Step 3:
Check             Update           Update
Eligibility       Settlement       Investor
    │                 │                │
if not valid:     status =         investor.
return error      "paid"           total_returns
                  payout_date =    += profit
                  NOW()             amount
    │                 │                │
    ▼                 ▼                ▼
    
Step 4:           Step 5:          Step 6:
Update            Create           Return
Pool              Audit Log        Success

pool.
available_funds   Log entry:
+= profit         Settlement paid
                  to Investor A
                  Amount: ₹2,500

                     │
                     ▼
        ┌─────────────────────────┐
        │  Database Updated ✓     │
        │  Audit Trail Created ✓  │
        │  Email Notification ?   │
        └─────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │ Frontend: Show Success  │
        │ Toast Notification      │
        │ Refresh Data            │
        └─────────────────────────┘
```

## 8. Real-Time Status Update Mechanism

```
How Status Auto-Updates from Pending to Eligible
──────────────────────────────────────────────────

Timeline:
Jan 10         Mar 30           Mar 31
  │              │                │
Created      Still Waiting    Eligible! ✨
Settlement                    
Status:pending

Every API call triggers:
──────────────────────────────

GET /profit-settlements
        ↓
    [Endpoint runs]
        ↓
    check_and_update_settlement_eligibility()
        ↓
    Query: WHERE
        status = "pending"
        AND payout_eligible_date <= NOW()
        ↓
    Update: SET status = "eligible"
        ↓
    [Return settled data with updated status]
        ↓
    Frontend displays "Eligible" ✓

This runs automatically!
• No background jobs needed
• No scheduled tasks required
• No additional servers needed
• Real-time upon page load
• Efficient and simple
```

## 9. User Journey Map

```
COMPLETE USER JOURNEY
─────────────────────────────────────────────────

Jan 10, 2027       March 31, 2027      April 5, 2027
   │                   │                   │
   
User: "Calculate      [System              User:
      settlements for  automatically       "Execute
      year 2026"       updates status]     payout now"
   │                   │                   │
   ▼                   ▼                   ▼
   
1. Click button    1. Page loads      1. Click button
2. Select year     2. API called      2. Confirm popup
3. Click submit    3. Status checks   3. Click confirm
4. See results     4. pending→        4. See success
   message         eligible           message
                   5. Visible ✓       5. Data refreshed

Status: pending    Status: eligible   Status: paid
"Waiting..."       "Ready to pay"     "Completed"

UI shows:          UI shows:          UI shows:
⏱ Pending          ⚠ Eligible         ✓ Paid
0% done            90% done           100% done
```

## 10. Error Handling Flow

```
SETTLEMENT PAYOUT ERRORS
────────────────────────────────────

User clicks "Execute Payout"
        ↓
Is settlement found?
    ├─ NO  → 404 Error
    │       "Settlement not found"
    │
    └─ YES
         ↓
    Is status = "eligible"?
        ├─ NO (status="paid")
        │   → 400 Error
        │   "Already paid"
        │
        ├─ NO (status="pending")
        │   → 400 Error
        │   "Not yet eligible"
        │   "Payout date: Mar 31, 2027"
        │
        └─ YES
             ↓
        Sufficient funds in pool?
            ├─ NO  → 400 Error
            │       "Insufficient pool funds"
            │
            └─ YES
                 ↓
            Investor exists?
                ├─ NO  → 400 Error
                │       "Investor not found"
                │
                └─ YES
                     ↓
                ✓ SUCCESS
                Execute payout
                Return 200 OK
```

---

This visual guide provides a complete overview of the Yearly Profit Settlement System implementation.
