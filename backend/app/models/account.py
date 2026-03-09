"""
FinBank - Pydantic Models for Accounts
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    FROZEN = "frozen"
    CLOSED = "closed"


class AccountCreateRequest(BaseModel):
    """Request body for opening a new account."""
    account_type: AccountType = AccountType.CHECKING
    currency: str = Field(default="TRY", pattern=r"^[A-Z]{3}$")


class AccountResponse(BaseModel):
    """Response for account data."""
    id: str
    account_number: str
    iban: str
    customer_id: str
    account_type: str
    currency: str
    status: str
    balance: Optional[float] = 0.0
    overdraft_limit: Optional[float] = 0.0
    account_name: Optional[str] = None
    created_at: datetime


class AccountBalanceResponse(BaseModel):
    """Response for account balance inquiry."""
    account_id: str
    account_number: str
    iban: str
    balance: float
    currency: str
    overdraft_limit: Optional[float] = 0.0
    account_name: Optional[str] = None
    computed_at: datetime
