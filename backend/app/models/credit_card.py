from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

class CreditCardCreate(BaseModel):
    # User will apply, backend checks risk, assigns limit
    pass

class CreditCardResponse(BaseModel):
    id: str
    customer_id: str
    card_number: str
    expiry_date: str
    cvv: str
    limit: float
    current_debt: float
    available_limit: float
    interest_rate: float
    status: str # active, blocked, frozen
    iban: Optional[str] = None
    account_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CreditCardPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to pay towards the credit card debt")
    from_account_id: str = Field(..., description="ID of the account to pay from")

class CreditCardTransaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    card_id: str
    amount: float
    type: str # 'purchase', 'payment', 'interest'
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
