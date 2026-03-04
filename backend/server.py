from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
    
    return {"message": "Transaction settled successfully"}

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
