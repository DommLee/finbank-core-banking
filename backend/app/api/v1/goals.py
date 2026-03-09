from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.goal import GoalCreate, GoalContribute, GoalResponse
from app.services.ledger_service import LedgerService
from app.core.exceptions import InsufficientFundsError, AccountNotFoundError, AccountFrozenError
import uuid

router = APIRouter(prefix="/goals", tags=["Goals"])

@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal: GoalCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    goal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    new_goal = {
        "goal_id": goal_id,
        "user_id": current_user["user_id"],
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": 0.0,
        "deadline": goal.deadline,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    await db.goals.insert_one(new_goal)
    new_goal.pop("_id", None)
    return new_goal

@router.get("", response_model=List[GoalResponse])
async def get_goals(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    goals = await db.goals.find({"user_id": current_user["user_id"]}).to_list(100)
    for g in goals:
        g.pop("_id", None)
    return goals

@router.post("/{goal_id}/contribute")
async def contribute_to_goal(
    goal_id: str,
    body: GoalContribute,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    goal = await db.goals.find_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal["status"] == "completed":
        raise HTTPException(status_code=400, detail="Goal is already completed")

    account = await db.accounts.find_one({"account_id": body.account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You don't own this account")
    if account["status"] != "active":
        raise AccountFrozenError()

    ledger = LedgerService(db)
    try:
        await ledger.withdraw(
            account_id=body.account_id,
            amount=body.amount,
            created_by=current_user["user_id"],
            description=f"Contribution to goal: {goal['name']}"
        )
    except InsufficientFundsError:
        raise HTTPException(status_code=400, detail="Insufficient funds in the selected account")

    new_amount = goal["current_amount"] + body.amount
    new_status = "completed" if new_amount >= goal["target_amount"] else "active"

    await db.goals.update_one(
        {"goal_id": goal_id},
        {"$set": {"current_amount": new_amount, "status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )

    return {"message": "Contribution successful", "current_amount": new_amount, "status": new_status}

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    result = await db.goals.delete_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return None
