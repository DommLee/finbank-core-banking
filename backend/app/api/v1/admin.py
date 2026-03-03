"""
FinBank - Admin API Routes
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from app.core.database import get_database
from app.core.security import require_admin
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/system/stats")
async def get_system_stats(
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """Admin: Get comprehensive system statistics for the CEO Dashboard."""
    
    # 1. Basic Counts
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    customers = await db.users.count_documents({"role": "customer"})
    employees = await db.users.count_documents({"role": {"$in": ["employee", "ceo", "admin"]}})
    
    # 2. Account Stats
    total_accounts = await db.accounts.count_documents({})
    active_accounts = await db.accounts.count_documents({"status": "active"})
    frozen_accounts = await db.accounts.count_documents({"status": "frozen"})
    
    # 3. Transaction Details
    total_transactions = await db.transactions.count_documents({})
    
    # 4. Messages & KYC
    total_messages = await db.messages.count_documents({})
    pending_kyc = await db.customers.count_documents({"status": "pending"})
    
    # 5. Financial Data for Charts (Last 30 days revenue/volume mock or real)
    # We will aggregate transaction volumes by type
    pipeline_tx_volume = [
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_volume": {"$sum": "$amount"}
        }}
    ]
    tx_volumes = await db.transactions.aggregate(pipeline_tx_volume).to_list(None)
    
    deposit_volume = next((x["total_volume"] for x in tx_volumes if x["_id"] == "DEPOSIT"), 0)
    withdraw_volume = next((x["total_volume"] for x in tx_volumes if x["_id"] == "WITHDRAWAL"), 0)
    transfer_volume = next((x["total_volume"] for x in tx_volumes if x["_id"] == "TRANSFER"), 0)
    
    # 6. Monthly Trend (Line Chart)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    pipeline_trend = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "volume": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trends = await db.transactions.aggregate(pipeline_trend).to_list(None)
    
    # Format daily_trends
    formatted_trends = [{"date": d["_id"], "volume": d["volume"], "count": d["count"]} for d in daily_trends]

    # 7. Account Types Distribution (Pie Chart)
    pipeline_acc_type = [
        {"$group": {
            "_id": "$account_type",
            "count": {"$sum": 1}
        }}
    ]
    acc_types = await db.accounts.aggregate(pipeline_acc_type).to_list(None)
    formatted_acc_types = [{"name": a["_id"], "value": a["count"]} for a in acc_types]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "customers": customers,
        "employees": employees,
        "total_accounts": total_accounts,
        "active_accounts": active_accounts,
        "frozen_accounts": frozen_accounts,
        "total_transactions": total_transactions,
        "total_messages": total_messages,
        "pending_kyc": pending_kyc,
        "financials": {
            "total_deposits": deposit_volume,
            "total_withdrawals": withdraw_volume,
            "total_transfers": transfer_volume,
            "net_liquidity": deposit_volume - withdraw_volume,
        },
        "daily_trends": formatted_trends,
        "account_types": formatted_acc_types
    }

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    skip = (page - 1) * limit
    filter_query = {}
    if role:
        filter_query["role"] = role
        
    total = await db.users.count_documents(filter_query)
    users = await db.users.find(filter_query, {"hashed_password": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(None)
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [
            {
                "user_id": u["user_id"],
                "email": u["email"],
                "role": u.get("role", "customer"),
                "is_active": u.get("is_active", True),
                "created_at": u["created_at"]
            } for u in users
        ]
    }

@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database)
):
    role = payload.get("role")
    if role not in ["customer", "employee", "ceo", "admin"]:
        raise HTTPException(400, "Invalid role")
        
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"role": role}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "Role updated"}

@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database)
):
    is_active = payload.get("is_active", True)
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"is_active": is_active}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "Status updated"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database)
):
    res = await db.users.delete_one({"user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "User deleted"}

@router.get("/all-messages")
async def all_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db=Depends(get_database)
):
    skip = (page - 1) * limit
    total = await db.messages.count_documents({})
    msgs = await db.messages.find({}).skip(skip).limit(limit).sort("created_at", -1).to_list(None)
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": msgs
    }
