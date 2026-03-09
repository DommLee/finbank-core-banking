from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime, timezone, timedelta
from app.core.database import get_database
from app.core.security import get_current_user

router = APIRouter(tags=["Analytics"])

@router.get("/spending-analysis")
async def get_spending_analysis(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}).to_list(100)
    if not accounts:
        return {"by_category": [], "daily": []}
    account_ids = [a["account_id"] for a in accounts]

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    pipeline_category = [
        {"$match": {"account_id": {"$in": account_ids}, "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$project": {
            "category": "$_id",
            "total": 1,
            "count": 1,
            "_id": 0
        }},
        {"$sort": {"total": -1}}
    ]
    
    pipeline_daily = [
        {"$match": {"account_id": {"$in": account_ids}, "created_at": {"$gte": thirty_days_ago}}},
        {"$project": {
            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "type": 1,
            "amount": 1
        }},
        {"$group": {
            "_id": {"date": "$date", "type": "$type"},
            "total": {"$sum": "$amount"}
        }},
        {"$project": {
            "date": "$_id.date",
            "type": "$_id.type",
            "total": 1,
            "_id": 0
        }},
        {"$sort": {"date": -1}}
    ]

    by_category = await db.ledger_entries.aggregate(pipeline_category).to_list(None)
    daily = await db.ledger_entries.aggregate(pipeline_daily).to_list(None)
    
    # We should convert 'total' fields (which might be Decimal128) to float so Pydantic/fastapi serializes them properly
    for item in by_category:
        try:
            item["total"] = float(str(item["total"]))
        except:
            pass

    for item in daily:
        try:
            item["total"] = float(str(item["total"]))
        except:
            pass

    return {"by_category": by_category, "daily": daily}
