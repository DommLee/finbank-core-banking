"""
FinBank Banking Service â€” Accounts, Transactions, Bills, Savings Goals
Port: 8002
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os, sys, uuid, random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.database import connect_to_mongo, close_mongo_connection, get_database
from shared.jwt_utils import get_current_user, require_admin
from shared.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    await db.accounts.create_index("account_number", unique=True)
    await db.accounts.create_index("customer_id")
    await db.accounts.create_index("user_id")
    await db.customers.create_index("national_id", unique=True)
    await db.customers.create_index("user_id")
    await db.ledger_entries.create_index([("transaction_ref", 1), ("account_id", 1), ("type", 1)], unique=True)
    await db.ledger_entries.create_index("account_id")
    await db.ledger_entries.create_index("created_at")
    await db.bills.create_index("user_id")
    await db.bills.create_index("paid_at")
    await db.savings_goals.create_index("user_id")
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Banking Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# â”€â”€ Models â”€â”€
class AccountCreateRequest(BaseModel):
    account_type: str = "checking"  # checking, savings
    currency: str = "TRY"

class DepositRequest(BaseModel):
    account_id: str
    amount: float
    description: Optional[str] = None

class WithdrawRequest(BaseModel):
    account_id: str
    amount: float
    description: Optional[str] = None

class TransferRequest(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float
    description: Optional[str] = None

class BillPayRequest(BaseModel):
    account_id: str
    bill_type: str
    provider: str
    subscriber_no: str
    amount: float

class GoalCreateRequest(BaseModel):
    name: str
    target_amount: float
    deadline: Optional[str] = None

class GoalContributeRequest(BaseModel):
    account_id: str
    amount: float


# â”€â”€ Ledger Helper â”€â”€
async def get_balance(db, account_id: str) -> float:
    pipeline = [
        {"$match": {"account_id": account_id}},
        {"$group": {"_id": None, "total": {
            "$sum": {"$cond": [{"$eq": ["$type", "CREDIT"]}, "$amount", {"$multiply": ["$amount", -1]}]}
        }}}
    ]
    result = await db.ledger_entries.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0.0


async def create_ledger_entry(db, account_id, entry_type, category, amount, txn_ref, created_by, description=""):
    entry = {
        "entry_id": str(uuid.uuid4()),
        "account_id": account_id,
        "type": entry_type,
        "category": category,
        "amount": amount,
        "transaction_ref": txn_ref,
        "description": description,
        "created_at": datetime.now(timezone.utc),
        "created_by": created_by,
    }
    await db.ledger_entries.insert_one(entry)
    return entry


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "banking-service"}


# â”€â”€ Customer Profile â”€â”€
@app.post("/customers")
async def create_customer(
    first_name: str, last_name: str, national_id: str, phone: str,
    current_user=Depends(get_current_user), db=Depends(get_database),
):
    existing = await db.customers.find_one({"user_id": current_user["user_id"]})
    if existing:
        raise HTTPException(400, "MÃ¼ÅŸteri profili zaten var.")

    doc = {
        "customer_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "first_name": first_name,
        "last_name": last_name,
        "national_id": national_id,
        "phone": phone,
        "status": "pending_kyc",
        "created_at": datetime.now(timezone.utc),
    }
    await db.customers.insert_one(doc)
    return {"message": "MÃ¼ÅŸteri profili oluÅŸturuldu.", "customer_id": doc["customer_id"]}


@app.get("/customers/me")
async def get_my_profile(current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# â”€â”€ Accounts â”€â”€
@app.post("/accounts")
async def create_account(body: AccountCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(400, "Ã–nce mÃ¼ÅŸteri profili oluÅŸturun.")
    if customer["status"] != "active":
        raise HTTPException(403, "KYC onayÄ± bekleniyor.")

    acc_num = f"{random.randint(1000000000, 9999999999)}"
    iban = f"TR00000100000{acc_num}0000000000"

    doc = {
        "account_id": str(uuid.uuid4()),
        "account_number": acc_num,
        "iban": iban,
        "customer_id": customer["customer_id"],
        "user_id": current_user["user_id"],
        "account_type": body.account_type,
        "currency": body.currency,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    await db.accounts.insert_one(doc)
    doc["_id"] = str(doc["_id"])
    return doc


@app.get("/accounts")
async def list_my_accounts(current_user=Depends(get_current_user), db=Depends(get_database)):
    accs = await db.accounts.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    for a in accs:
        a["_id"] = str(a["_id"])
        a["balance"] = await get_balance(db, a["account_id"])
    return accs


@app.get("/accounts/all")
async def list_all_accounts(current_user=Depends(require_admin), db=Depends(get_database)):
    accs = await db.accounts.find().sort("created_at", -1).to_list(200)
    for a in accs:
        a["_id"] = str(a["_id"])
    return accs


@app.get("/accounts/{account_id}/balance")
async def account_balance(account_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise HTTPException(404, "Hesap bulunamadÄ±.")
    if account["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(403, "EriÅŸim reddedildi.")
    balance = await get_balance(db, account_id)
    return {"account_id": account_id, "balance": balance, "currency": account["currency"]}


@app.patch("/accounts/{account_id}/toggle-freeze")
async def toggle_freeze(account_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise HTTPException(404, "Hesap bulunamadÄ±.")
    if account["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(403, "EriÅŸim reddedildi.")
    new_status = "frozen" if account["status"] == "active" else "active"
    await db.accounts.update_one({"account_id": account_id}, {"$set": {"status": new_status}})
    return {"message": f"Hesap {'donduruldu â„ï¸' if new_status == 'frozen' else 'aktifleÅŸtirildi âœ…'}", "status": new_status}


# â”€â”€ Transactions â”€â”€
@app.post("/transactions/deposit")
async def deposit(body: DepositRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await db.accounts.find_one({"account_id": body.account_id})
    if not account or account["status"] != "active":
        raise HTTPException(400, "Hesap aktif deÄŸil veya bulunamadÄ±.")
    if account["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(403, "EriÅŸim reddedildi.")
    txn_ref = f"DEP-{uuid.uuid4().hex[:8].upper()}"
    entry = await create_ledger_entry(db, body.account_id, "CREDIT", "DEPOSIT", body.amount, txn_ref, current_user["user_id"], body.description or "Para YatÄ±rma")
    return {"message": "Para yatÄ±rÄ±ldÄ± âœ…", "transaction_ref": txn_ref, "amount": body.amount}


@app.post("/transactions/withdraw")
async def withdraw(body: WithdrawRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await db.accounts.find_one({"account_id": body.account_id})
    if not account or account["status"] != "active":
        raise HTTPException(400, "Hesap aktif deÄŸil.")
    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(400, "Yetersiz bakiye.")
    txn_ref = f"WDR-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(db, body.account_id, "DEBIT", "WITHDRAWAL", body.amount, txn_ref, current_user["user_id"], body.description or "Para Ã‡ekme")
    return {"message": "Para Ã§ekildi âœ…", "transaction_ref": txn_ref, "amount": body.amount}


@app.post("/transactions/transfer")
async def transfer(body: TransferRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    if body.from_account_id == body.to_account_id:
        raise HTTPException(400, "AynÄ± hesaba transfer yapÄ±lamaz.")
    from_acc = await db.accounts.find_one({"account_id": body.from_account_id})
    to_acc = await db.accounts.find_one({"account_id": body.to_account_id})
    if not from_acc or not to_acc:
        raise HTTPException(404, "Hesap bulunamadÄ±.")
    if from_acc["status"] != "active" or to_acc["status"] != "active":
        raise HTTPException(400, "Hesaplardan biri aktif deÄŸil.")
    balance = await get_balance(db, body.from_account_id)
    if balance < body.amount:
        raise HTTPException(400, "Yetersiz bakiye.")

    txn_ref = f"TRF-{uuid.uuid4().hex[:8].upper()}"
    desc = body.description or "Transfer"
    await create_ledger_entry(db, body.from_account_id, "DEBIT", "TRANSFER_OUT", body.amount, txn_ref, current_user["user_id"], desc)
    await create_ledger_entry(db, body.to_account_id, "CREDIT", "TRANSFER_IN", body.amount, txn_ref, current_user["user_id"], desc)
    return {"message": "Transfer baÅŸarÄ±lÄ± âœ…", "transaction_ref": txn_ref, "amount": body.amount}


# â”€â”€ Ledger â”€â”€
@app.get("/ledger/{account_id}")
async def get_ledger(account_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    entries = await db.ledger_entries.find({"account_id": account_id}).sort("created_at", -1).to_list(100)
    for e in entries:
        e["_id"] = str(e["_id"])
    return entries


@app.get("/ledger")
async def get_all_ledger(current_user=Depends(get_current_user), db=Depends(get_database)):
    accs = await db.accounts.find({"user_id": current_user["user_id"]}).to_list(50)
    acc_ids = [a["account_id"] for a in accs]
    entries = await db.ledger_entries.find({"account_id": {"$in": acc_ids}}).sort("created_at", -1).to_list(200)
    for e in entries:
        e["_id"] = str(e["_id"])
    return entries


# â”€â”€ Bills â”€â”€
@app.post("/bills/pay")
async def pay_bill(body: BillPayRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await db.accounts.find_one({"account_id": body.account_id})
    if not account or account["status"] != "active":
        raise HTTPException(400, "Hesap aktif deÄŸil.")
    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(400, "Yetersiz bakiye.")

    txn_ref = f"BILL-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(db, body.account_id, "DEBIT", "WITHDRAWAL", body.amount, txn_ref, current_user["user_id"], f"Fatura: {body.provider}")

    bill_doc = {
        "bill_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "account_id": body.account_id,
        "bill_type": body.bill_type,
        "provider": body.provider,
        "subscriber_no": body.subscriber_no,
        "amount": body.amount,
        "status": "paid",
        "paid_at": datetime.now(timezone.utc),
    }
    await db.bills.insert_one(bill_doc)
    return {"message": f"{body.provider} faturasÄ± Ã¶dendi âœ…", "bill_id": bill_doc["bill_id"]}


@app.get("/bills/history")
async def bill_history(current_user=Depends(get_current_user), db=Depends(get_database)):
    bills = await db.bills.find({"user_id": current_user["user_id"]}).sort("paid_at", -1).to_list(50)
    for b in bills:
        b["_id"] = str(b["_id"])
    return bills


# â”€â”€ Savings Goals â”€â”€
@app.post("/goals")
async def create_goal(body: GoalCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = {
        "goal_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "name": body.name,
        "target_amount": body.target_amount,
        "current_amount": 0,
        "deadline": body.deadline,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    await db.savings_goals.insert_one(doc)
    return {"message": "Tasarruf hedefi oluÅŸturuldu ğŸ¯", "goal_id": doc["goal_id"]}


@app.get("/goals")
async def list_goals(current_user=Depends(get_current_user), db=Depends(get_database)):
    goals = await db.savings_goals.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(20)
    for g in goals:
        g["_id"] = str(g["_id"])
    return goals


@app.post("/goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, body: GoalContributeRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    goal = await db.savings_goals.find_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    if not goal:
        raise HTTPException(404, "Hedef bulunamadÄ±.")

    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(400, "Yetersiz bakiye.")

    txn_ref = f"GOAL-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(db, body.account_id, "DEBIT", "WITHDRAWAL", body.amount, txn_ref, current_user["user_id"], f"Tasarruf: {goal['name']}")

    new_amount = goal["current_amount"] + body.amount
    status = "completed" if new_amount >= goal["target_amount"] else "active"
    await db.savings_goals.update_one(
        {"goal_id": goal_id},
        {"$set": {"current_amount": new_amount, "status": status}}
    )
    return {"message": f"â‚º{body.amount} eklendi ğŸ’°", "current_amount": new_amount, "status": status}


@app.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.savings_goals.delete_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    return {"message": "Hedef silindi."}


# â”€â”€ Currency Exchange â”€â”€
MOCK_RATES = {"USD": 32.50, "EUR": 35.20, "GBP": 41.10, "TRY": 1.0}

@app.get("/exchange-rates")
async def get_exchange_rates():
    return {"rates": MOCK_RATES, "base": "TRY", "updated_at": datetime.now(timezone.utc).isoformat()}
