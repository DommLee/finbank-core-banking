"""
FinBank - Account Management API Routes
"""
import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from app.core.database import get_database
from app.core.security import get_current_user, require_admin, require_staff
from app.models.account import (
    AccountCreateRequest, AccountResponse, AccountBalanceResponse,
)
from app.services.ledger_service import LedgerService
from app.services.audit_service import log_audit, get_client_info
from app.events.webhook import send_webhook, WebhookEvent
from app.services.supabase_sync import sync_account

router = APIRouter(prefix="/accounts", tags=["Account Management"])


def _generate_account_number() -> str:
    """Generate a unique 10-digit account number."""
    return f"{random.randint(1000000000, 9999999999)}"


def _generate_iban(account_number: str) -> str:
    """Generate a mock Turkish IBAN."""
    bank_code = "0001"
    branch_code = "0000"
    return f"TR00{bank_code}{branch_code}{account_number}0000000000"


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Open a new bank account."""
    # Verify customer profile exists
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=400, detail="Please create a customer profile first")

    if customer["status"] != "active":
        raise HTTPException(status_code=403, detail="Customer profile is not active. Wait for KYC approval.")

    account_number = _generate_account_number()
    iban = _generate_iban(account_number)

    account_doc = {
        "account_id": str(uuid.uuid4()),
        "account_number": account_number,
        "iban": iban,
        "customer_id": customer["customer_id"],
        "user_id": current_user["user_id"],
        "account_type": body.account_type.value,
        "currency": body.currency,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }

    await db.accounts.insert_one(account_doc)
    await sync_account(account_doc)

    # Auto-create debit card for the new account
    from datetime import timedelta
    debit_card = {
        "id": str(uuid.uuid4()),
        "account_id": account_doc["account_id"],
        "customer_id": customer["customer_id"],
        "card_number": "5" + "".join([str(random.randint(0, 9)) for _ in range(15)]),
        "expiry_date": (datetime.now(timezone.utc) + timedelta(days=365*5)).strftime("%m/%y"),
        "cvv": "".join([str(random.randint(0, 9)) for _ in range(3)]),
        "card_type": "debit",
        "holder_name": customer.get("full_name", current_user.get("email", "Kart Sahibi")).upper(),
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    await db.debit_cards.insert_one(debit_card)

    ip, ua = get_client_info(request)
    await log_audit(
        action="ACCOUNT_CREATED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Account {account_number} ({body.account_type.value}) created",
        ip_address=ip,
        user_agent=ua,
    )

    background_tasks.add_task(send_webhook, WebhookEvent.ACCOUNT_CREATED, {
        "account_id": account_doc["account_id"],
        "account_number": account_number,
        "customer_id": customer["customer_id"],
    })

    return AccountResponse(
        id=account_doc["account_id"],
        account_number=account_doc["account_number"],
        iban=account_doc["iban"],
        customer_id=account_doc["customer_id"],
        account_type=account_doc["account_type"],
        currency=account_doc["currency"],
        status=account_doc["status"],
        created_at=account_doc["created_at"],
    )


@router.get("/", response_model=list[AccountResponse])
async def list_my_accounts(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List all accounts owned by the current user."""
    cursor = db.accounts.find({"user_id": current_user["user_id"]}).sort("created_at", -1)
    accounts = await cursor.to_list(50)
    
    ledger = LedgerService(db)
    result = []
    for a in accounts:
        balance = await ledger.get_balance(a["account_id"])
        result.append(
            AccountResponse(
                id=a["account_id"],
                account_number=a["account_number"],
                iban=a["iban"],
                customer_id=a["customer_id"],
                account_type=a["account_type"],
                currency=a["currency"],
                status=a["status"],
                balance=balance,
                created_at=a["created_at"],
            )
        )
    return result


@router.get("/debit-cards")
async def get_debit_cards(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all debit cards owned by the customer."""
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        return []

    cursor = db.debit_cards.find({"customer_id": customer["customer_id"]})
    cards = await cursor.to_list(100)
    
    # Format them to mimic the credit card schema for the UI
    result = []
    for c in cards:
        result.append({
            "id": c.get("id"),
            "account_id": c.get("account_id"),
            "card_number": c.get("card_number"),
            "expiry_date": c.get("expiry_date"),
            "cvv": c.get("cvv"),
            "card_type": c.get("card_type", "debit"),
            "holder_name": c.get("holder_name"),
            "cardholder_name": c.get("holder_name"),
            "status": c.get("status"),
            "is_virtual": False,
            "created_at": c.get("created_at"),
            "available_limit": 0,
            "current_debt": 0,
            "min_payment_due": 0,
            "online_limit": 0,
            "internet_shopping": True,
            "contactless": True,
        })
    return result

@router.get("/{account_id}/balance", response_model=AccountBalanceResponse)
async def get_account_balance(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get account balance (computed from ledger entries)."""
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Only allow owner or admin to see balance
    if account["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    ledger = LedgerService(db)
    balance = await ledger.get_balance(account_id)

    return AccountBalanceResponse(
        account_id=account["account_id"],
        account_number=account["account_number"],
        iban=account["iban"],
        balance=balance,
        currency=account["currency"],
        computed_at=datetime.now(timezone.utc),
    )


@router.get("/all", response_model=list[AccountResponse])
async def list_all_accounts(
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """Admin: List all accounts in the system."""
    cursor = db.accounts.find().sort("created_at", -1)
    accounts = await cursor.to_list(200)
    
    ledger = LedgerService(db)
    result = []
    for a in accounts:
        balance = await ledger.get_balance(a["account_id"])
        result.append(
            AccountResponse(
                id=a["account_id"],
                account_number=a["account_number"],
                iban=a["iban"],
                customer_id=a["customer_id"],
                account_type=a["account_type"],
                currency=a["currency"],
                status=a["status"],
                balance=balance,
                created_at=a["created_at"],
            )
        )
    return result


@router.get("/customer/{customer_id}", response_model=list[AccountResponse])
async def list_customer_accounts(
    customer_id: str,
    current_user: dict = Depends(require_staff),
    db=Depends(get_database),
):
    """Staff: List all accounts owned by a specific customer."""
    cursor = db.accounts.find({"customer_id": customer_id}).sort("created_at", -1)
    accounts = await cursor.to_list(50)
    
    ledger = LedgerService(db)
    result = []
    for a in accounts:
        balance = await ledger.get_balance(a["account_id"])
        result.append(
            AccountResponse(
                id=a["account_id"],
                account_number=a["account_number"],
                iban=a["iban"],
                customer_id=a["customer_id"],
                account_type=a["account_type"],
                currency=a["currency"],
                status=a["status"],
                balance=balance,
                created_at=a["created_at"],
            )
        )
    return result


@router.patch("/{account_id}/toggle-freeze")
async def toggle_freeze(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Toggle freeze/unfreeze on an account (card control)."""
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Hesap bulunamadı.")
    if account["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Erişim reddedildi.")

    new_status = "frozen" if account["status"] == "active" else "active"
    await db.accounts.update_one(
        {"account_id": account_id},
        {"$set": {"status": new_status}}
    )

    status_text = "donduruldu ❄️" if new_status == "frozen" else "aktifleştirildi ✅"
    return {"message": f"Hesap {status_text}", "status": new_status}


@router.get("/debit-cards")
async def get_my_debit_cards(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all debit cards for user's accounts."""
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}).to_list(100)
    account_ids = [a["account_id"] for a in accounts]
    account_map = {a["account_id"]: a for a in accounts}

    if not account_ids:
        return []

    cards = await db.debit_cards.find({"account_id": {"$in": account_ids}}).to_list(100)
    result = []
    for c in cards:
        c.pop("_id", None)
        acc = account_map.get(c.get("account_id"), {})
        c["account_number"] = acc.get("account_number", "")
        c["iban"] = acc.get("iban", "")
        c["account_type"] = acc.get("account_type", "")
        result.append(c)

    return result
