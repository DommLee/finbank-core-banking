"""
FinBank - Pydantic Models for Transactions (Deposit, Withdraw, Transfer)
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DepositRequest(BaseModel):
    """Request body for a simulated deposit."""
    account_id: str
    amount: float = Field(..., gt=0, le=1000000, description="Amount to deposit")
    description: Optional[str] = "Deposit"


class WithdrawRequest(BaseModel):
    """Request body for a withdrawal."""
    account_id: str
    amount: float = Field(..., gt=0, le=1000000, description="Amount to withdraw")
    description: Optional[str] = "Withdrawal"


class TransferRequest(BaseModel):
    """Request body for an internal transfer."""
    from_account_id: str
    to_account_id: Optional[str] = Field(None, description="Target account ID")
    target_iban: Optional[str] = Field(None, description="Target IBAN if account ID is not provided")
    amount: float = Field(..., gt=0, le=1000000, description="Amount to transfer")
    description: Optional[str] = "Internal Transfer"


class TransactionResponse(BaseModel):
    """Response for any transaction."""
    transaction_ref: str
    type: str
    amount: float
    status: str
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
