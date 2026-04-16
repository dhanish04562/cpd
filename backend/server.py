from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class InvestorCreate(BaseModel):
    name: str
    email: str
    phone: str
    contribution_amount: float

class Investor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    contribution_amount: float
    date_joined: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date_left: Optional[datetime] = None
    status: str = "active"
    total_returns: float = 0.0

class SellerCreate(BaseModel):
    name: str
    contact_person: str
    phone: str
    payment_terms_days: int
    discount_percentage: float

class Seller(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_person: str
    phone: str
    payment_terms_days: int
    discount_percentage: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    seller_id: str
    amount_paid: float
    invoice_number: str
    notes: Optional[str] = None

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    seller_name: str
    amount_paid: float
    discount_received: float
    investor_share: float
    shop_share: float
    invoice_number: str
    notes: Optional[str] = None
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    settlement_due_date: datetime
    settlement_date: Optional[datetime] = None
    settlement_status: str = "pending"
    payment_terms_days: int

class SettlementUpdate(BaseModel):
    transaction_id: str

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # investor_joined, investor_exited, transaction_created, transaction_settled, pool_updated
    entity_type: str  # investor, transaction, pool
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    description: str
    details: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    performed_by: str = "admin"

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def create_audit_log(event_type: str, entity_type: str, description: str,
                          entity_id: str = None, entity_name: str = None,
                          details: dict = None, performed_by: str = "admin"):
    log = AuditLog(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        description=description,
        details=details or {},
        performed_by=performed_by
    )
    doc = log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)
    return log

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Default admin credentials
    if user.username == "admin" and user.password == "admin123":
        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# Investor endpoints
@api_router.post("/investors", response_model=Investor)
async def create_investor(investor: InvestorCreate, username: str = Depends(verify_token)):
    investor_obj = Investor(**investor.model_dump())
    doc = investor_obj.model_dump()
    doc['date_joined'] = doc['date_joined'].isoformat()
    await db.investors.insert_one(doc)
    
    # Update pool
    pool = await db.pool.find_one({}, {"_id": 0})
    if pool:
        await db.pool.update_one(
            {},
            {"$inc": {"total_amount": investor.contribution_amount, "available_funds": investor.contribution_amount}}
        )
    else:
        await db.pool.insert_one({
            "total_amount": investor.contribution_amount,
            "deployed_capital": 0.0,
            "available_funds": investor.contribution_amount
        })
    
    # Get updated pool for audit log
    updated_pool = await db.pool.find_one({}, {"_id": 0})
    await create_audit_log(
        event_type="investor_joined",
        entity_type="investor",
        entity_id=investor_obj.id,
        entity_name=investor_obj.name,
        description=f"Investor '{investor_obj.name}' joined the pool with a contribution of ₹{investor.contribution_amount:,.2f}",
        details={
            "contribution_amount": investor.contribution_amount,
            "investor_email": investor.email,
            "investor_phone": investor.phone,
            "pool_total_after": updated_pool.get("total_amount", 0) if updated_pool else investor.contribution_amount,
            "pool_available_after": updated_pool.get("available_funds", 0) if updated_pool else investor.contribution_amount,
        },
        performed_by=username
    )
    
    return investor_obj

@api_router.get("/investors", response_model=List[Investor])
async def get_investors(username: str = Depends(verify_token)):
    investors = await db.investors.find({"status": "active"}, {"_id": 0}).to_list(1000)
    for inv in investors:
        if isinstance(inv['date_joined'], str):
            inv['date_joined'] = datetime.fromisoformat(inv['date_joined'])
        if inv.get('date_left') and isinstance(inv['date_left'], str):
            inv['date_left'] = datetime.fromisoformat(inv['date_left'])
    return investors

@api_router.get("/investors/inactive")
async def get_inactive_investors(username: str = Depends(verify_token)):
    investors = await db.investors.find({"status": "inactive"}, {"_id": 0}).to_list(1000)
    for inv in investors:
        if isinstance(inv['date_joined'], str):
            inv['date_joined'] = datetime.fromisoformat(inv['date_joined'])
        if inv.get('date_left') and isinstance(inv['date_left'], str):
            inv['date_left'] = datetime.fromisoformat(inv['date_left'])
    return investors

@api_router.delete("/investors/{investor_id}")
async def remove_investor(investor_id: str, username: str = Depends(verify_token)):
    investor = await db.investors.find_one({"id": investor_id}, {"_id": 0})
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")
    
    # Update investor status
    await db.investors.update_one(
        {"id": investor_id},
        {"$set": {"status": "inactive", "date_left": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update pool
    await db.pool.update_one(
        {},
        {"$inc": {"total_amount": -investor['contribution_amount'], "available_funds": -investor['contribution_amount']}}
    )
    
    # Get updated pool for audit log
    updated_pool = await db.pool.find_one({}, {"_id": 0})
    await create_audit_log(
        event_type="investor_exited",
        entity_type="investor",
        entity_id=investor_id,
        entity_name=investor.get("name", "Unknown"),
        description=f"Investor '{investor.get('name', 'Unknown')}' exited the pool. Contribution of ₹{investor['contribution_amount']:,.2f} withdrawn.",
        details={
            "contribution_amount": investor['contribution_amount'],
            "total_returns_earned": investor.get("total_returns", 0),
            "investor_email": investor.get("email", ""),
            "investor_phone": investor.get("phone", ""),
            "date_joined": investor.get("date_joined", ""),
            "date_exited": datetime.now(timezone.utc).isoformat(),
            "pool_total_after": updated_pool.get("total_amount", 0) if updated_pool else 0,
            "pool_available_after": updated_pool.get("available_funds", 0) if updated_pool else 0,
        },
        performed_by=username
    )
    
    return {"message": "Investor removed successfully"}

@api_router.delete("/investors/{investor_id}/permanent")
async def delete_investor_permanent(investor_id: str, username: str = Depends(verify_token)):
    investor = await db.investors.find_one({"id": investor_id}, {"_id": 0})
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")
    
    # Only allow permanent deletion of inactive investors
    if investor['status'] == 'active':
        raise HTTPException(status_code=400, detail="Cannot delete active investor. Deactivate first.")
    
    # Delete investor permanently
    await db.investors.delete_one({"id": investor_id})
    
    return {"message": "Investor permanently deleted"}

# Seller endpoints
@api_router.post("/sellers", response_model=Seller)
async def create_seller(seller: SellerCreate, username: str = Depends(verify_token)):
    seller_obj = Seller(**seller.model_dump())
    doc = seller_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sellers.insert_one(doc)
    return seller_obj

@api_router.get("/sellers", response_model=List[Seller])
async def get_sellers(username: str = Depends(verify_token)):
    sellers = await db.sellers.find({}, {"_id": 0}).to_list(1000)
    for seller in sellers:
        if isinstance(seller['created_at'], str):
            seller['created_at'] = datetime.fromisoformat(seller['created_at'])
    return sellers

@api_router.get("/sellers/{seller_id}", response_model=Seller)
async def get_seller(seller_id: str, username: str = Depends(verify_token)):
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if isinstance(seller['created_at'], str):
        seller['created_at'] = datetime.fromisoformat(seller['created_at'])
    return seller

# Transaction endpoints
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate, username: str = Depends(verify_token)):
    # Get seller details
    seller = await db.sellers.find_one({"id": transaction.seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Check available funds
    pool = await db.pool.find_one({}, {"_id": 0})
    if not pool or pool['available_funds'] < transaction.amount_paid:
        raise HTTPException(status_code=400, detail="Insufficient funds in pool")
    
    # Calculate discount and split
    discount_received = transaction.amount_paid * (seller['discount_percentage'] / 100)
    investor_share = discount_received * 0.70
    shop_share = discount_received * 0.30
    
    # Create transaction
    payment_date = datetime.now(timezone.utc)
    settlement_due_date = payment_date + timedelta(days=seller['payment_terms_days'])
    
    transaction_obj = Transaction(
        seller_id=transaction.seller_id,
        seller_name=seller['name'],
        amount_paid=transaction.amount_paid,
        discount_received=discount_received,
        investor_share=investor_share,
        shop_share=shop_share,
        invoice_number=transaction.invoice_number,
        notes=transaction.notes,
        payment_date=payment_date,
        settlement_due_date=settlement_due_date,
        payment_terms_days=seller['payment_terms_days']
    )
    
    doc = transaction_obj.model_dump()
    doc['payment_date'] = doc['payment_date'].isoformat()
    doc['settlement_due_date'] = doc['settlement_due_date'].isoformat()
    await db.transactions.insert_one(doc)
    
    # Update pool
    await db.pool.update_one(
        {},
        {"$inc": {"deployed_capital": transaction.amount_paid, "available_funds": -transaction.amount_paid}}
    )
    
    # Audit log for transaction creation
    updated_pool = await db.pool.find_one({}, {"_id": 0})
    await create_audit_log(
        event_type="transaction_created",
        entity_type="transaction",
        entity_id=transaction_obj.id,
        entity_name=seller['name'],
        description=f"New transaction of ₹{transaction.amount_paid:,.2f} with seller '{seller['name']}'. Discount: ₹{discount_received:,.2f} (Investor: ₹{investor_share:,.2f} | Shop: ₹{shop_share:,.2f})",
        details={
            "seller_name": seller['name'],
            "amount_paid": transaction.amount_paid,
            "discount_received": discount_received,
            "investor_share": investor_share,
            "shop_share": shop_share,
            "invoice_number": transaction.invoice_number,
            "payment_terms_days": seller['payment_terms_days'],
            "settlement_due_date": settlement_due_date.isoformat(),
            "pool_deployed_after": updated_pool.get("deployed_capital", 0) if updated_pool else 0,
            "pool_available_after": updated_pool.get("available_funds", 0) if updated_pool else 0,
        },
        performed_by=username
    )
    
    return transaction_obj

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(username: str = Depends(verify_token)):
    transactions = await db.transactions.find({}, {"_id": 0}).sort("payment_date", -1).to_list(1000)
    for txn in transactions:
        if isinstance(txn['payment_date'], str):
            txn['payment_date'] = datetime.fromisoformat(txn['payment_date'])
        if isinstance(txn['settlement_due_date'], str):
            txn['settlement_due_date'] = datetime.fromisoformat(txn['settlement_due_date'])
        if txn.get('settlement_date') and isinstance(txn['settlement_date'], str):
            txn['settlement_date'] = datetime.fromisoformat(txn['settlement_date'])
    return transactions

@api_router.post("/transactions/settle")
async def settle_transaction(settlement: SettlementUpdate, username: str = Depends(verify_token)):
    transaction = await db.transactions.find_one({"id": settlement.transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction['settlement_status'] == "settled":
        raise HTTPException(status_code=400, detail="Transaction already settled")
    
    # Update transaction
    await db.transactions.update_one(
        {"id": settlement.transaction_id},
        {"$set": {"settlement_status": "settled", "settlement_date": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update pool - money comes back plus investor share
    amount_returned = transaction['amount_paid'] + transaction['investor_share']
    await db.pool.update_one(
        {},
        {"$inc": {"deployed_capital": -transaction['amount_paid'], "available_funds": amount_returned}}
    )
    
    # Distribute returns to investors proportionally
    investors = await db.investors.find({"status": "active"}, {"_id": 0}).to_list(1000)
    total_contribution = sum(inv['contribution_amount'] for inv in investors)
    
    if total_contribution > 0:
        for inv in investors:
            proportion = inv['contribution_amount'] / total_contribution
            investor_return = transaction['investor_share'] * proportion
            await db.investors.update_one(
                {"id": inv['id']},
                {"$inc": {"total_returns": investor_return}}
            )
    
    # Audit log for settlement
    updated_pool = await db.pool.find_one({}, {"_id": 0})
    distribution_details = []
    if total_contribution > 0:
        for inv in investors:
            proportion = inv['contribution_amount'] / total_contribution
            investor_return = transaction['investor_share'] * proportion
            distribution_details.append({
                "investor_name": inv.get('name', 'Unknown'),
                "investor_id": inv['id'],
                "proportion": round(proportion * 100, 2),
                "return_amount": round(investor_return, 2)
            })
    
    await create_audit_log(
        event_type="transaction_settled",
        entity_type="transaction",
        entity_id=settlement.transaction_id,
        entity_name=transaction.get('seller_name', 'Unknown'),
        description=f"Transaction with '{transaction.get('seller_name', 'Unknown')}' settled. ₹{amount_returned:,.2f} returned to pool (₹{transaction['amount_paid']:,.2f} principal + ₹{transaction['investor_share']:,.2f} investor returns).",
        details={
            "seller_name": transaction.get('seller_name', 'Unknown'),
            "amount_paid": transaction['amount_paid'],
            "amount_returned": amount_returned,
            "investor_share": transaction['investor_share'],
            "shop_share": transaction['shop_share'],
            "return_distribution": distribution_details,
            "pool_deployed_after": updated_pool.get("deployed_capital", 0) if updated_pool else 0,
            "pool_available_after": updated_pool.get("available_funds", 0) if updated_pool else 0,
        },
        performed_by=username
    )
    
    return {"message": "Transaction settled successfully"}

# Audit Log endpoints
@api_router.get("/audit-logs")
async def get_audit_logs(
    event_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    username: str = Depends(verify_token)
):
    query = {}
    if event_type:
        query["event_type"] = event_type
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(500)
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    return logs

@api_router.get("/audit-logs/investor/{investor_id}")
async def get_investor_audit_logs(investor_id: str, username: str = Depends(verify_token)):
    logs = await db.audit_logs.find(
        {"entity_id": investor_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(500)
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    return logs

# Dashboard endpoints
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(username: str = Depends(verify_token)):
    pool = await db.pool.find_one({}, {"_id": 0}) or {"total_amount": 0, "deployed_capital": 0, "available_funds": 0}
    
    total_investors = await db.investors.count_documents({"status": "active"})
    total_sellers = await db.sellers.count_documents({})
    
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    total_transactions = len(transactions)
    pending_settlements = len([t for t in transactions if t['settlement_status'] == 'pending'])
    total_returns_generated = sum(t['investor_share'] + t['shop_share'] for t in transactions)
    
    return {
        "pool": pool,
        "total_investors": total_investors,
        "total_sellers": total_sellers,
        "total_transactions": total_transactions,
        "pending_settlements": pending_settlements,
        "total_returns_generated": total_returns_generated
    }

@api_router.get("/reports/investor-returns")
async def get_investor_returns(username: str = Depends(verify_token)):
    investors = await db.investors.find({"status": "active"}, {"_id": 0}).to_list(1000)
    return investors

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
