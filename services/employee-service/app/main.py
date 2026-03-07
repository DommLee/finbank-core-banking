"""
FinBank Employee Service - KYC Approval, Customer Management, Transaction Validation
Port: 8006
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
import os
import sys

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import settings
from shared.database import close_mongo_connection, connect_to_mongo, get_database
from shared.jwt_utils import get_current_user, require_employee


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Employee Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class KYCDecisionRequest(BaseModel):
    decision: str
    notes: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "employee-service"}


@app.get("/kyc/pending")
async def list_pending_kyc(current_user=Depends(require_employee), db=Depends(get_database)):
    customers = await db.customers.find({"status": "pending_kyc"}).sort("created_at", -1).to_list(50)
    result = []
    for customer in customers:
        customer["_id"] = str(customer["_id"])
        user = await db.users.find_one({"user_id": customer["user_id"]}, {"password_hash": 0})
        if user:
            user["_id"] = str(user["_id"])
            customer["user"] = user
        result.append(customer)
    return result


@app.get("/kyc/all")
async def list_all_kyc(
    status: Optional[str] = None,
    current_user=Depends(require_employee),
    db=Depends(get_database),
):
    query = {}
    if status:
        query["status"] = status
    customers = await db.customers.find(query).sort("created_at", -1).to_list(100)
    for customer in customers:
        customer["_id"] = str(customer["_id"])
    return customers


@app.patch("/kyc/{customer_id}/decision")
async def kyc_decision(
    customer_id: str,
    body: KYCDecisionRequest,
    current_user=Depends(require_employee),
    db=Depends(get_database),
):
    if body.decision not in ["approved", "rejected"]:
        raise HTTPException(400, "Gecersiz karar. 'approved' veya 'rejected' olmali.")

    customer = await db.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(404, "Musteri bulunamadi.")

    reviewed_at = datetime.now(timezone.utc)
    new_status = "active" if body.decision == "approved" else "rejected"
    new_user_kyc_status = "APPROVED" if body.decision == "approved" else "REJECTED"

    await db.customers.update_one(
        {"customer_id": customer_id},
        {
            "$set": {
                "status": new_status,
                "kyc_decision": body.decision,
                "kyc_notes": body.notes,
                "kyc_reviewed_by": current_user["email"],
                "kyc_reviewed_at": reviewed_at,
            }
        },
    )
    await db.users.update_one(
        {"user_id": customer["user_id"]},
        {"$set": {"kyc_status": new_user_kyc_status}},
    )

    await db.audit_logs.insert_one(
        {
            "action": "KYC_DECISION",
            "user_id": current_user["user_id"],
            "customer_id": customer_id,
            "decision": body.decision,
            "notes": body.notes,
            "timestamp": reviewed_at,
        }
    )

    message = "KYC onaylandi." if body.decision == "approved" else "KYC reddedildi."
    return {"message": message, "status": new_status}


@app.get("/customers")
async def search_customers(
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(require_employee),
    db=Depends(get_database),
):
    query = {}
    if q:
        query["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"national_id": {"$regex": q, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    customers = await db.customers.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.customers.count_documents(query)
    for customer in customers:
        customer["_id"] = str(customer["_id"])
    return {"data": customers, "total": total, "page": page}


@app.get("/customers/{customer_id}")
async def get_customer_detail(
    customer_id: str,
    current_user=Depends(require_employee),
    db=Depends(get_database),
):
    customer = await db.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(404, "Musteri bulunamadi.")
    customer["_id"] = str(customer["_id"])

    user = await db.users.find_one({"user_id": customer["user_id"]}, {"password_hash": 0})
    if user:
        user["_id"] = str(user["_id"])

    accounts = await db.accounts.find({"user_id": customer["user_id"]}).to_list(50)
    for account in accounts:
        account["_id"] = str(account["_id"])

    recent_transactions = await db.ledger_entries.find(
        {"account_id": {"$in": [account["account_id"] for account in accounts]}}
    ).sort("created_at", -1).to_list(20)
    for transaction in recent_transactions:
        transaction["_id"] = str(transaction["_id"])

    return {
        "customer": customer,
        "user": user,
        "accounts": accounts,
        "recent_transactions": recent_transactions,
    }


@app.get("/dashboard")
async def employee_dashboard(current_user=Depends(require_employee), db=Depends(get_database)):
    return {
        "pending_kyc": await db.customers.count_documents({"status": "pending_kyc"}),
        "total_customers": await db.customers.count_documents({}),
        "open_messages": await db.messages.count_documents({"status": "open"}),
        "today_transactions": await db.ledger_entries.count_documents(
            {"created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}}
        ),
    }