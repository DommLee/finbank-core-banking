from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

class GoalCreate(BaseModel):
    name: str = Field(..., max_length=100)
    target_amount: float = Field(..., gt=0)
    deadline: Optional[str] = None

class GoalContribute(BaseModel):
    account_id: str
    amount: float = Field(..., gt=0)

class GoalResponse(BaseModel):
    goal_id: str
    user_id: str
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[str] = None
    status: str = "active"
    created_at: datetime
    updated_at: datetime
