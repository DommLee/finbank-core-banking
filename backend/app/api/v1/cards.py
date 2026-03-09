from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone, timedelta
import random
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.credit_card import CreditCardResponse, CreditCardCreate, CreditCardPaymentRequest, CreditCardTransaction

router = APIRouter()

def generate_cc_number():
    # Generate a dummy 16-digit credit card number starting with 4 (Visa)
    return "4" + "".join([str(random.randint(0, 9)) for _ in range(15)])

def generate_cvv():
    return "".join([str(random.randint(0, 9)) for _ in range(3)])

@router.post("/apply", response_model=CreditCardResponse)
async def apply_for_credit_card(
    request: CreditCardCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user.get("user_id")
    customer = await db.customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    # Check if they already have an active card
    existing_card = await db.credit_cards.find_one({
        "customer_id": customer["customer_id"],
        "status": {"$in": ["active", "frozen"]}
    })
    
    if existing_card:
        raise HTTPException(status_code=400, detail="You already have an active credit card")

    # Deterministic Risk Assessment: Assign limit based on their actual account balances
    # We sum all active accounts and give a multiplier.
    accounts = await db.accounts.find({
        "customer_id": customer["customer_id"],
        "status": "active"
    }).to_list(100)

    total_balance = sum(acc.get("balance", 0) for acc in accounts)
    
    # Base limit: 5000, Max limit: 100000, Multiplier: 2x total balance
    assigned_limit = max(5000, min(total_balance * 2.0, 100000))

    expiry = datetime.now(timezone.utc) + timedelta(days=365*4)

    # Fetch dynamic interest rate
    config = await db.system_configs.find_one({"key": "CREDIT_CARD_INTEREST_RATE"})
    interest_rate = config.get("value", 3.5) if config else 3.5

    card_doc = {
        "id": str(uuid.uuid4()),
        "customer_id": customer["customer_id"],
        "card_number": generate_cc_number(),
        "expiry_date": expiry.strftime("%m/%y"),
        "cvv": generate_cvv(),
        "limit": float(assigned_limit),
        "current_debt": 0.0,
        "available_limit": float(assigned_limit),
        "interest_rate": float(interest_rate),
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    await db.credit_cards.insert_one(card_doc.copy())

    from app.api.v1.accounts import _generate_account_number, _generate_iban
    account_number = _generate_account_number()
    iban = _generate_iban(account_number)
    
    account_doc = {
        "account_id": str(uuid.uuid4()),
        "customer_id": customer["customer_id"],
        "user_id": current_user["user_id"],
        "account_type": "credit",
        "currency": "TRY",
        "balance": 0.0,
        "status": "active",
        "account_name": f"Kredi Kartı ({card_doc['card_number'][-4:]})",
        "overdraft_limit": float(assigned_limit),
        "card_id": card_doc["id"],
        "account_number": account_number,
        "iban": iban,
        "created_at": datetime.now(timezone.utc),
    }
    await db.accounts.insert_one(account_doc)

    card_doc.pop("_id", None)
    card_doc["account_id"] = account_doc["account_id"]
    card_doc["iban"] = account_doc["iban"]
    return card_doc

@router.get("/", response_model=List[CreditCardResponse])
async def get_my_credit_cards(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user.get("user_id")
    customer = await db.customers.find_one({"user_id": user_id})
    if not customer:
        return []

    cursor = db.credit_cards.find({"customer_id": customer["customer_id"]})
    cards = await cursor.to_list(100)
    for c in cards:
        c.pop("_id", None)
        acc = await db.accounts.find_one({"card_id": c["id"]})
        if acc:
            c["iban"] = acc.get("iban")
            c["account_id"] = acc.get("account_id")
    return cards

@router.post("/{card_id}/pay")
async def pay_credit_card_debt(
    card_id: str,
    request: CreditCardPaymentRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user.get("user_id")
    customer = await db.customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Verify origin account
    account = await db.accounts.find_one({
        "account_id": request.from_account_id,
        "customer_id": customer["customer_id"]
    })
    
    if not account:
        raise HTTPException(status_code=404, detail="Source account not found or doesn't belong to you")
    if account["balance"] < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds in source account")
        
    # Verify the card
    card = await db.credit_cards.find_one({
        "id": card_id,
        "customer_id": customer["customer_id"]
    })
    
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
        
    if request.amount > card["current_debt"]:
        raise HTTPException(status_code=400, detail="Payment amount exceeds current debt")

    # Start transaction session ideally, but we will do it sequentially here (MongoDB free tier might not support pure transactions without replica sets)
    
    # 1. Deduct from account
    await db.accounts.update_one(
        {"account_id": request.from_account_id},
        {"$inc": {"balance": -request.amount}}
    )
    
    # 2. Update card debt and available limit
    await db.credit_cards.update_one(
        {"id": card_id},
        {
            "$inc": {
                "current_debt": -request.amount,
                "available_limit": request.amount
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # 3. Log ledger transaction for account
    tx_doc = {
        "transaction_id": str(uuid.uuid4()),
        "from_account_id": request.from_account_id,
        "to_account_id": f"CC_PAYMENT_{card_id}",
        "amount": request.amount,
        "currency": account["currency"],
        "description": f"Kredi Kartı Borç Ödemesi ({card['card_number'][-4:]})",
        "status": "completed",
        "type": "cc_payment",
        "created_at": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(tx_doc)
    
    # 4. Log cc transaction
    cc_tx = CreditCardTransaction(
        card_id=card_id,
        amount=request.amount,
        type="payment",
        description="Borç Ödemesi"
    )
    await db.credit_card_transactions.insert_one(cc_tx.model_dump())

    return {"msg": "Payment successful"}

@router.post("/{card_id}/purchase")
async def credit_card_purchase(
    card_id: str,
    amount: float,
    description: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    # This acts as a mock for real world card terminal charging the card.
    user_id = current_user.get("user_id")
    customer = await db.customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    card = await db.credit_cards.find_one({
        "id": card_id,
        "customer_id": customer["customer_id"],
        "status": "active"
    })

    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found or inactive")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    if card["available_limit"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient available limit")

    await db.credit_cards.update_one(
        {"id": card_id},
        {
            "$inc": {
                "current_debt": amount,
                "available_limit": -amount
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )

    cc_tx = CreditCardTransaction(
        card_id=card_id,
        amount=amount,
        type="purchase",
        description=description
    )
    await db.credit_card_transactions.insert_one(cc_tx.model_dump())

    return {"msg": "Purchase successful"}

@router.get("/{card_id}/transactions")
async def get_card_transactions(
    card_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user.get("user_id")
    customer = await db.customers.find_one({"user_id": user_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Security check: Does card belong to customer?
    card = await db.credit_cards.find_one({
        "id": card_id,
        "customer_id": customer["customer_id"]
    })
    
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")

    cursor = db.credit_card_transactions.find({"card_id": card_id}).sort("created_at", -1)
    txs = await cursor.to_list(100)
    for t in txs:
        t.pop("_id", None)
    return txs
