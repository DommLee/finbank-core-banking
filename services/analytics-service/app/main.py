"""
FinBank Analytics Service â€” Audit Logs, Reports, Stats, Spending Analysis
Port: 8004
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
import os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.database import connect_to_mongo, close_mongo_connection, get_database
from shared.jwt_utils import get_current_user, require_staff
from shared.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    await db.audit_logs.create_index("timestamp")
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("action")
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Analytics Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "analytics-service"}


# â”€â”€ Audit Logs â”€â”€
@app.get("/audit-logs")
async def get_audit_logs(
    page: int = 1, limit: int = 20,
    current_user=Depends(require_staff), db=Depends(get_database),
):
    skip = (page - 1) * limit
    logs = await db.audit_logs.find().sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents({})
    for l in logs:
        l["_id"] = str(l["_id"])
    return {"data": logs, "total": total, "page": page}


# â”€â”€ Dashboard Stats â”€â”€
@app.get("/stats/overview")
async def overview_stats(current_user=Depends(require_staff), db=Depends(get_database)):
    total_users = await db.users.count_documents({})
    total_accounts = await db.accounts.count_documents({})
    total_ledger = await db.ledger_entries.count_documents({})
    total_messages = await db.messages.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    pending_kyc = await db.customers.count_documents({"status": "pending_kyc"})

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_accounts": total_accounts,
        "total_transactions": total_ledger,
        "total_messages": total_messages,
        "pending_kyc": pending_kyc,
    }


# â”€â”€ Spending Analysis (Customer) â”€â”€
@app.get("/spending-analysis")
async def spending_analysis(current_user=Depends(get_current_user), db=Depends(get_database)):
    accs = await db.accounts.find({"user_id": current_user["user_id"]}).to_list(50)
    acc_ids = [a["account_id"] for a in accs]

    # Last 30 days
    since = datetime.now(timezone.utc) - timedelta(days=30)

    pipeline = [
        {"$match": {"account_id": {"$in": acc_ids}, "type": "DEBIT", "created_at": {"$gte": since}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    by_category = await db.ledger_entries.aggregate(pipeline).to_list(20)

    # Daily totals
    daily_pipeline = [
        {"$match": {"account_id": {"$in": acc_ids}, "created_at": {"$gte": since}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "type": "$type",
            },
            "total": {"$sum": "$amount"},
        }},
        {"$sort": {"_id.date": 1}},
    ]
    daily = await db.ledger_entries.aggregate(daily_pipeline).to_list(100)

    return {
        "by_category": [{"category": c["_id"], "total": c["total"], "count": c["count"]} for c in by_category],
        "daily": [{"date": d["_id"]["date"], "type": d["_id"]["type"], "total": d["total"]} for d in daily],
    }


# â”€â”€ Monthly Report â”€â”€
@app.get("/reports/monthly")
async def monthly_report(
    year: int = None, month: int = None,
    current_user=Depends(require_staff), db=Depends(get_database),
):
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month

    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": "$type",
            "total_amount": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }}
    ]
    result = await db.ledger_entries.aggregate(pipeline).to_list(10)

    deposits = next((r for r in result if r["_id"] == "CREDIT"), {"total_amount": 0, "count": 0})
    withdrawals = next((r for r in result if r["_id"] == "DEBIT"), {"total_amount": 0, "count": 0})

    new_users = await db.users.count_documents({"created_at": {"$gte": start, "$lt": end}})
    new_accounts = await db.accounts.count_documents({"created_at": {"$gte": start, "$lt": end}})

    return {
        "period": f"{year}-{month:02d}",
        "total_deposits": deposits["total_amount"],
        "deposit_count": deposits["count"],
        "total_withdrawals": withdrawals["total_amount"],
        "withdrawal_count": withdrawals["count"],
        "net_flow": deposits["total_amount"] - withdrawals["total_amount"],
        "new_users": new_users,
        "new_accounts": new_accounts,
    }
