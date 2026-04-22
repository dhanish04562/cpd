# Yearly Profit Settlement System Implementation Guide

## Overview
This implementation adds a complete Yearly Profit Settlement System with a 90-day payout delay to the CPD (Customer Purchase Discount) platform.

## System Rules

### Rule 1: Profit Calculation
- **Timing**: Profits are calculated yearly per investor
- **Basis**: Based on transactions settled during that calendar year
- **Calculation**: Each investor receives a proportional share based on their contribution amount relative to total active investor contributions
- **Formula**: `Investor Profit = (Sum of investor_share from settled transactions in year Y) × (Investor Contribution / Total Active Contributions)`

### Rule 2: 90-Day Payout Delay
- **Year End**: Dec 31 of settlement year (e.g., Dec 31, 2026)
- **Delay Period**: Additional 90 days after year ends
- **Payout Eligible Date**: Mar 31 of following year (e.g., Mar 31, 2027)
- **Timeline Example**:
  - Investment Date: Jan 1, 2026
  - Year 1 Ends: Dec 31, 2026
  - Payout Eligible: Mar 31, 2027
  - Actual Payout: Mar 31, 2027 (or later, upon execution)

## Database Models

### YearlyProfitSettlement
```python
{
  "id": "uuid",
  "investor_id": "string",
  "investor_name": "string",
  "settlement_year": "integer",           # e.g., 2026
  "profit_amount": "float",               # calculated profit
  "calculation_date": "datetime",         # when calculation was done
  "payout_eligible_date": "datetime",     # year_end + 90 days
  "payout_date": "datetime (optional)",   # when payout executed
  "status": "string"                      # enum: pending, eligible, paid
}
```

### Status Transitions
1. **pending**: Created at year-end calculation, waiting for 90-day delay
2. **eligible**: Automatically updated when current date >= payout_eligible_date
3. **paid**: Updated when payout is executed

## Backend API Endpoints

### 1. Calculate Yearly Settlements
**Endpoint**: `POST /api/profit-settlements/calculate?year={year}`
**Auth**: Required
**Purpose**: Calculate and create profit settlements for all active investors for the specified year
**Returns**: 
```json
{
  "message": "Created X settlement(s) for year Y",
  "count": X
}
```
**Behavior**:
- Checks all active investors
- Calculates their yearly profit from settled transactions
- Creates settlement records with payout_eligible_date = year_end + 90 days
- Creates audit logs for each settlement
- Skips investors if settlement already exists for that year

### 2. Get All Profit Settlements
**Endpoint**: `GET /api/profit-settlements`
**Auth**: Required
**Query Parameters**:
- `investor_id` (optional): Filter by investor
- `year` (optional): Filter by year
- `status` (optional): Filter by status (pending, eligible, paid)
**Returns**: Array of YearlyProfitSettlement objects
**Behavior**: Automatically checks and updates settlement eligibility before returning

### 3. Get Investor Profit Settlements
**Endpoint**: `GET /api/profit-settlements/investor/{investor_id}`
**Auth**: Required
**Returns**: Array of YearlyProfitSettlement objects for the investor
**Behavior**: Automatically checks and updates settlement eligibility

### 4. Execute Settlement Payout
**Endpoint**: `POST /api/profit-settlements/{settlement_id}/payout`
**Auth**: Required
**Purpose**: Execute payout for an eligible settlement
**Returns**: `{"message": "Payout executed successfully"}`
**Behavior**:
- Validates settlement exists
- Validates settlement status is "eligible" (not pending or already paid)
- Updates settlement status to "paid" with payout_date
- Increments investor's total_returns
- Updates pool available_funds
- Creates audit log entry
**Error Cases**:
- Settlement not found: 404
- Settlement not eligible: 400 (if pending)
- Settlement already paid: 400

### 5. Get Settlement Statistics
**Endpoint**: `GET /api/profit-settlements/stats`
**Auth**: Required
**Returns**:
```json
{
  "total_settlements": 10,
  "pending_count": 3,
  "eligible_count": 2,
  "paid_count": 5,
  "total_profit_pending": 50000.00,
  "total_profit_eligible": 30000.00,
  "total_profit_paid": 100000.00
}
```
**Behavior**: Automatically checks and updates settlement eligibility before calculating

## Helper Functions

### check_and_update_settlement_eligibility()
- **Purpose**: Auto-promotes settlements from "pending" to "eligible" when 90-day delay has passed
- **Called by**: All settlement endpoints before returning data
- **Implementation**: Updates all settlements where status="pending" and current_time >= payout_eligible_date
- **Frequency**: Once per endpoint call (cached between calls)

### calculate_investor_yearly_profit(investor_id, year)
- **Purpose**: Calculate profit earned by specific investor in specific year
- **Steps**:
  1. Get all settled transactions from that year
  2. Get investor's contribution amount
  3. Get all active investors and sum their contributions
  4. For each settled transaction in that year:
     - Calculate: transaction.investor_share × (investor_contribution / total_contribution)
     - Add to running total
  5. Return total yearly profit
- **Returns**: Float amount
- **Edge Cases**: Returns 0 if investor not found or total contribution is 0

## Frontend Pages

### Profit Settlements Page (`/profit-settlements`)
**Features**:
1. **Stats Dashboard**:
   - Pending count and amount
   - Eligible count and amount
   - Paid count and amount
   - Total settlements and total amount

2. **Settlement Table**:
   - Investor name
   - Settlement year
   - Profit amount
   - Calculation date
   - Payout eligible date
   - Current status (with icon)
   - Actions (Execute Payout button for eligible settlements)

3. **Status Filters**:
   - All, Pending, Eligible, Paid

4. **Calculate Year Modal**:
   - Year selector (2020 to current year)
   - Confirmation message
   - Submit button

5. **Payout Confirmation**:
   - Shows investor name and profit amount
   - Single-click execution with confirmation

## Audit Logging

All profit settlement events are logged with:
- **Event Type**: 
  - `yearly_profit_settlement_created`: When settlement is calculated
  - `yearly_profit_settlement_paid`: When payout is executed
- **Entity Type**: `profit_settlement`
- **Details**: Includes investor info, amounts, dates, and pool state

## Usage Examples

### Example 1: End-of-Year Settlement Calculation
**Date**: January 10, 2027
**Action**: Calculate 2026 settlements
```
POST /api/profit-settlements/calculate?year=2026

Response:
{
  "message": "Created 5 settlement(s) for year 2026",
  "count": 5
}
```
- For each active investor:
  - Sum profit_amount from all transactions settled during 2026
  - Create settlement with payout_eligible_date = Mar 31, 2027
  - Status: pending

### Example 2: Check Eligibility
**Date**: April 1, 2027 (past 90-day delay)
**Action**: Get settlements
```
GET /api/profit-settlements?status=pending

On endpoint call:
- System checks: current_date >= payout_eligible_date
- Updates all matching settlements: status = pending → eligible

Response:
[
  {
    "id": "uuid1",
    "investor_name": "Investor A",
    "settlement_year": 2026,
    "profit_amount": 50000,
    "status": "eligible",
    "payout_eligible_date": "2027-03-31T23:59:59Z"
  },
  ...
]
```

### Example 3: Execute Payout
**Date**: April 5, 2027
**Action**: Execute payout for Investor A's 2026 settlement
```
POST /api/profit-settlements/{settlement_id}/payout

Behavior:
1. Validate settlement exists and status = "eligible"
2. Update: status = "paid", payout_date = now
3. Update: investor.total_returns += 50000
4. Update: pool.available_funds += 50000
5. Create audit log
6. Return success

Response:
{
  "message": "Payout executed successfully"
}
```

## Key Implementation Details

### Automatic Eligibility Promotion
- Settlement eligibility is checked on every API call
- No background job needed
- Transitions happen based on system time
- Allows flexibility in payout timing (can execute anytime after eligible date)

### Contribution-Based Distribution
- Profits distributed based on contribution amounts
- Uses current investor contribution (not historical)
- Means newly joined investors get their share from year-end forward
- Ensures proportional fairness at execution time

### Pool Integration
- Profit payout returns funds to pool.available_funds
- Maintains pool tracking
- Updates visible in Dashboard stats
- Prepares funds for potential reinvestment

### Investor Returns Tracking
- investor.total_returns updated upon payout
- Used for ROI calculations in Reports
- Visible in Investors list
- Supports investor performance tracking

## Testing the System

### Manual Test Scenario
1. Create 2-3 investors with different contribution amounts
2. Create transactions and settle them
3. Calculate settlements for past year
4. Verify settlement records created with correct amounts
5. Check settlement status is "pending"
6. Fast-forward system time past 90-day mark (or run eligibility check)
7. Verify status automatically updates to "eligible"
8. Execute payout
9. Verify status updates to "paid"
10. Verify investor.total_returns increased
11. Check audit logs for all events

### Data Validation
- Verify profit_amount = correct calculation
- Verify payout_eligible_date = year_end + 90 days
- Verify status transitions are correct
- Verify audit trail tracks all changes
- Verify pool amounts stay consistent

## Future Enhancements

1. **Historical Contribution Tracking**: Store investor contribution at settlement time for more accurate profit distribution
2. **Settlement Reversals**: Allow reversal of paid settlements if needed
3. **Bulk Payout Processing**: Execute multiple payouts with single action
4. **Settlement Reports**: Detailed investor-wise settlement history
5. **Scheduled Automatic Payouts**: Auto-execute eligible settlements on specific dates
6. **Settlement Adjustments**: Allow profit adjustments for corrections
7. **Tax Reporting**: Generate tax statements per investor
8. **Settlement Analytics**: Dashboard showing settlement trends and patterns
