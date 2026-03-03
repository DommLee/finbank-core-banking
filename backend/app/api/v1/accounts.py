"""
FinBank - Account Management API Routes
"""
import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
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

    await send_webhook(WebhookEvent.ACCOUNT_CREATED, {
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
    return [
        AccountResponse(
            id=a["account_id"],
            account_number=a["account_number"],
            iban=a["iban"],
            customer_id=a["customer_id"],
            account_type=a["account_type"],
            currency=a["currency"],
            status=a["status"],
            created_at=a["created_at"],
        )
        for a in accounts
    ]


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
    return [
        AccountResponse(
            id=a["account_id"],
            account_number=a["account_number"],
            iban=a["iban"],
            customer_id=a["customer_id"],
            account_type=a["account_type"],
            currency=a["currency"],
            status=a["status"],
            created_at=a["created_at"],
        )
        for a in accounts
    ]


@router.get("/customer/{customer_id}", response_model=list[AccountResponse])
async def list_customer_accounts(
    customer_id: str,
    current_user: dict = Depends(require_staff),
    db=Depends(get_database),
):
    """Staff: List all accounts owned by a specific customer."""
    cursor = db.accounts.find({"customer_id": customer_id}).sort("created_at", -1)
    accounts = await cursor.to_list(50)
    return [
        AccountResponse(
            id=a["account_id"],
            account_number=a["account_number"],
            iban=a["iban"],
            customer_id=a["customer_id"],
            account_type=a["account_type"],
            currency=a["currency"],
            status=a["status"],
            created_at=a["created_at"],
        )
        for a in accounts
    ]


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
