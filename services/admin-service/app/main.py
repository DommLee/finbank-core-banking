"""
FinBank Admin Service â€” User Management, System Settings, Full Access
Port: 8005
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.database import connect_to_mongo, close_mongo_connection, get_database
from shared.jwt_utils import require_admin
from shared.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Admin Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class RoleUpdateRequest(BaseModel):
    role: str

class UserStatusRequest(BaseModel):
    is_active: bool


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "admin-service"}


# â”€â”€ User Management â”€â”€
@app.get("/users")
async def list_users(
    page: int = 1, limit: int = 20, role: Optional[str] = None,
    current_user=Depends(require_admin), db=Depends(get_database),
):
    query = {}
    if role:
        query["role"] = role
    skip = (page - 1) * limit
    users = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    for u in users:
        u["_id"] = str(u["_id"])
    return {"data": users, "total": total, "page": page}


@app.get("/users/{user_id}")
async def get_user(user_id: str, current_user=Depends(require_admin), db=Depends(get_database)):
    user = await db.users.find_one({"user_id": user_id}, {"password_hash": 0})
    if not user:
        raise HTTPException(404, "KullanÄ±cÄ± bulunamadÄ±.")
    user["_id"] = str(user["_id"])

    customer = await db.customers.find_one({"user_id": user_id})
    accounts = await db.accounts.find({"user_id": user_id}).to_list(50)
    for a in accounts:
        a["_id"] = str(a["_id"])
    if customer:
        customer["_id"] = str(customer["_id"])

    return {"user": user, "customer": customer, "accounts": accounts}


@app.patch("/users/{user_id}/role")
async def change_role(user_id: str, body: RoleUpdateRequest, current_user=Depends(require_admin), db=Depends(get_database)):
    if body.role not in ["customer", "employee", "admin", "ceo"]:
        raise HTTPException(400, "GeÃ§ersiz rol.")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    await db.audit_logs.insert_one({
        "action": "ROLE_CHANGE",
        "user_id": current_user["user_id"],
        "target_user_id": user_id,
        "new_role": body.role,
        "timestamp": datetime.now(timezone.utc),
    })
    return {"message": f"Rol '{body.role}' olarak gÃ¼ncellendi."}


@app.patch("/users/{user_id}/status")
async def toggle_user_status(user_id: str, body: UserStatusRequest, current_user=Depends(require_admin), db=Depends(get_database)):
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_active": body.is_active}})
    status_text = "aktifleÅŸtirildi âœ…" if body.is_active else "devre dÄ±ÅŸÄ± bÄ±rakÄ±ldÄ± â›”"
    await db.audit_logs.insert_one({
        "action": "USER_STATUS_CHANGE",
        "user_id": current_user["user_id"],
        "target_user_id": user_id,
        "is_active": body.is_active,
        "timestamp": datetime.now(timezone.utc),
    })
    return {"message": f"KullanÄ±cÄ± {status_text}"}


@app.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user=Depends(require_admin), db=Depends(get_database)):
    await db.users.delete_one({"user_id": user_id})
    await db.customers.delete_one({"user_id": user_id})
    await db.sessions.delete_many({"user_id": user_id})
    await db.audit_logs.insert_one({
        "action": "USER_DELETED",
        "user_id": current_user["user_id"],
        "target_user_id": user_id,
        "timestamp": datetime.now(timezone.utc),
    })
    return {"message": "KullanÄ±cÄ± silindi."}


# â”€â”€ System Stats â”€â”€
@app.get("/system/stats")
async def system_stats(current_user=Depends(require_admin), db=Depends(get_database)):
    stats = {
        "total_users": await db.users.count_documents({}),
        "active_users": await db.users.count_documents({"is_active": True}),
        "customers": await db.users.count_documents({"role": "customer"}),
        "employees": await db.users.count_documents({"role": "employee"}),
        "admins": await db.users.count_documents({"role": "admin"}),
        "total_accounts": await db.accounts.count_documents({}),
        "active_accounts": await db.accounts.count_documents({"status": "active"}),
        "frozen_accounts": await db.accounts.count_documents({"status": "frozen"}),
        "total_transactions": await db.ledger_entries.count_documents({}),
        "total_messages": await db.messages.count_documents({}),
        "open_messages": await db.messages.count_documents({"status": "open"}),
        "pending_kyc": await db.customers.count_documents({"status": "pending_kyc"}),
    }
    return stats


# â”€â”€ All Messages â”€â”€
@app.get("/all-messages")
async def all_messages(
    page: int = 1, limit: int = 20,
    current_user=Depends(require_admin), db=Depends(get_database),
):
    skip = (page - 1) * limit
    msgs = await db.messages.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.messages.count_documents({})
    for m in msgs:
        m["_id"] = str(m["_id"])
    return {"data": msgs, "total": total, "page": page}


# â”€â”€ All Bills â”€â”€
@app.get("/all-bills")
async def all_bills(
    page: int = 1, limit: int = 20,
    current_user=Depends(require_admin), db=Depends(get_database),
):
    skip = (page - 1) * limit
    bills = await db.bills.find().sort("paid_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.bills.count_documents({})
    for b in bills:
        b["_id"] = str(b["_id"])
    return {"data": bills, "total": total, "page": page}
