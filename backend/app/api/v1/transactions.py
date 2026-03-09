"""
FinBank - Transaction API Routes (Deposits, Withdrawals, Transfers)
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Header, BackgroundTasks
from app.core.database import get_database
from app.core.security import get_current_user
from app.core.exceptions import (
    InsufficientFundsError, AccountNotFoundError,
    AccountFrozenError, SameAccountTransferError,
)
from app.models.transaction import (
    DepositRequest, WithdrawRequest,
    TransferRequest, TransactionResponse,
)
from app.services.ledger_service import LedgerService
from app.services.audit_service import log_audit, get_client_info
from app.events.webhook import send_webhook, publish_transfer_events, WebhookEvent

router = APIRouter(prefix="/transactions", tags=["Transactions"])


async def _validate_account_ownership(
    db, account_id: str, user_id: str, role: str, allow_employee_override: bool = False
) -> dict:
    """Validate account exists, is active, and owned by user."""
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise AccountNotFoundError(account_id)
    if account["status"] != "active":
        raise AccountFrozenError()
    
    if account["user_id"] != user_id:
        if role == "admin":
            pass
        elif role == "employee" and allow_employee_override:
            pass
        else:
            raise HTTPException(status_code=403, detail="You don't own this account")
            
    return account


@router.post("/deposit", response_model=TransactionResponse)
async def deposit(
    body: DepositRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Deposit money into an account (simulated funding)."""
    if idempotency_key:
        cached_result = await db.idempotency_keys.find_one({"key": idempotency_key})
        if cached_result:
            return cached_result["response_data"]
    account = await _validate_account_ownership(
        db, body.account_id, current_user["user_id"], current_user["role"], allow_employee_override=True
    )

    from app.api.v1.approvals import _generate_mock_ai_risk_score
    accounts = await db.accounts.find({
        "user_id": current_user["user_id"],
        "status": "active"
    }).to_list(100)
    total_balance = sum(acc.get("balance", 0) for acc in accounts)
    risk_score = _generate_mock_ai_risk_score(body.amount or 0, total_balance)
    
    now = datetime.now(timezone.utc)
    import str, uuid
    import uuid
    approval_doc = {
        "user_id": current_user["user_id"],
        "user_name": current_user.get("full_name", current_user["email"]),
        "request_type": "DEPOSIT",
        "amount": body.amount,
        "currency": account.get("currency", "TRY"),
        "description": body.description,
        "status": "PENDING_EMPLOYER",
        "risk_score": risk_score,
        "metadata": {"account_id": body.account_id},
        "created_at": now,
        "updated_at": now,
        "employer_notes": None,
        "ceo_notes": None
    }
    await db.approvals.insert_one(approval_doc)

    ip, ua = get_client_info(request)
    await log_audit(
        action="DEPOSIT_REQUESTED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Deposit request {body.amount} {account['currency']} to {account['account_number']}",
        ip_address=ip,
        user_agent=ua,
    )

    response = TransactionResponse(
        transaction_ref="PENDING-" + str(uuid.uuid4())[:8],
        type="DEPOSIT",
        amount=body.amount,
        status="pending_approval",
        to_account=body.account_id,
        description=body.description,
        created_at=now,
    )

    if idempotency_key:
        await db.idempotency_keys.insert_one({
            "key": idempotency_key,
            "response_data": response.model_dump(),
            "created_at": datetime.now(timezone.utc)
        })

    return response


@router.post("/withdraw", response_model=TransactionResponse)
async def withdraw(
    body: WithdrawRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Withdraw money from an account."""
    if idempotency_key:
        cached_result = await db.idempotency_keys.find_one({"key": idempotency_key})
        if cached_result:
            return cached_result["response_data"]
    account = await _validate_account_ownership(
        db, body.account_id, current_user["user_id"], current_user["role"]
    )

    ledger = LedgerService(db)
    try:
        entry = await ledger.withdraw(
            account_id=body.account_id,
            amount=body.amount,
            created_by=current_user["user_id"],
            description=body.description or "Withdrawal",
        )
    except InsufficientFundsError:
        ip, ua = get_client_info(request)
        await log_audit(
            action="WITHDRAWAL_EXECUTED",
            outcome="FAILURE",
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            role=current_user["role"],
            details=f"Insufficient funds for {body.amount} {account['currency']}",
            ip_address=ip,
            user_agent=ua,
        )
        raise

    ip, ua = get_client_info(request)
    await log_audit(
        action="WITHDRAWAL_EXECUTED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Withdrawal {body.amount} {account['currency']} from {account['account_number']}",
        ip_address=ip,
        user_agent=ua,
    )

    background_tasks.add_task(
        send_webhook,
        WebhookEvent.WITHDRAWAL_COMPLETED,
        {
            "account_id": body.account_id,
            "amount": body.amount,
            "transaction_ref": entry["transaction_ref"],
        }
    )

    response = TransactionResponse(
        transaction_ref=entry["transaction_ref"],
        type="WITHDRAWAL",
        amount=body.amount,
        status="completed",
        from_account=body.account_id,
        description=body.description,
        created_at=entry["created_at"],
    )

    if idempotency_key:
        await db.idempotency_keys.insert_one({
            "key": idempotency_key,
            "response_data": response.model_dump(),
            "created_at": datetime.now(timezone.utc)
        })

    return response


@router.post("/transfer", response_model=TransactionResponse)
async def transfer(
    body: TransferRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Transfer money between accounts (internal transfer)."""
    if idempotency_key:
        cached_result = await db.idempotency_keys.find_one({"key": idempotency_key})
        if cached_result:
            return cached_result["response_data"]
    if not body.to_account_id and not body.target_iban and not body.target_alias:
        raise HTTPException(status_code=400, detail="Either 'to_account_id', 'target_iban', or 'target_alias' is required.")

    # Validate source account ownership
    from_account = await _validate_account_ownership(
        db, body.from_account_id, current_user["user_id"], current_user["role"]
    )

    # Validate target account exists and is active
    to_account = None
    if body.to_account_id:
        to_account = await db.accounts.find_one({"account_id": body.to_account_id})
    elif body.target_iban:
        to_account = await db.accounts.find_one({"iban": body.target_iban})
        if to_account:
            body.to_account_id = to_account["account_id"]
    elif body.target_alias:
        # Resolve Easy Address
        address = await db.easy_addresses.find_one({"alias_value": body.target_alias})
        if not address:
            raise HTTPException(status_code=404, detail="Easy address (target_alias) not found")
        to_account = await db.accounts.find_one({"account_id": address["account_id"]})
        if to_account:
            body.to_account_id = to_account["account_id"]

    if not to_account:
        raise HTTPException(status_code=404, detail="Target account not found")

    if body.from_account_id == body.to_account_id:
        raise SameAccountTransferError()

    if to_account["status"] != "active":
        raise AccountFrozenError()

    ledger = LedgerService(db)
    ip, ua = get_client_info(request)

    try:
        txn_ref = await ledger.execute_transfer(
            from_account_id=body.from_account_id,
            to_account_id=body.to_account_id,
            amount=body.amount,
            created_by=current_user["user_id"],
            description=body.description or "Internal Transfer",
        )
    except InsufficientFundsError:
        await log_audit(
            action="TRANSFER_FAILED",
            outcome="FAILURE",
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            role=current_user["role"],
            details=f"Insufficient funds: {body.amount} from {from_account['account_number']}",
            ip_address=ip,
            user_agent=ua,
        )
        raise

    await log_audit(
        action="TRANSFER_EXECUTED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Transfer {body.amount} from {from_account['account_number']} to {to_account['account_number']}",
        ip_address=ip,
        user_agent=ua,
    )

    # Publish all 4 required webhook events in background
    background_tasks.add_task(
        publish_transfer_events,
        transfer_id=txn_ref,
        from_account=body.from_account_id,
        to_account=body.to_account_id,
        amount=body.amount,
        currency=from_account.get("currency", "TRY")
    )

    response = TransactionResponse(
        transaction_ref=txn_ref,
        type="TRANSFER",
        amount=body.amount,
        status="completed",
        from_account=body.from_account_id,
        to_account=body.to_account_id,
        description=body.description,
        created_at=datetime.now(timezone.utc),
    )

    if idempotency_key:
        await db.idempotency_keys.insert_one({
            "key": idempotency_key,
            "response_data": response.model_dump(),
            "created_at": datetime.now(timezone.utc)
        })

    return response


@router.get("/history")
async def get_transaction_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get transaction history for all user accounts."""
    # Get all user accounts
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}).to_list(100)
    account_ids = [a["account_id"] for a in accounts]
    account_map = {a["account_id"]: a for a in accounts}

    if not account_ids:
        return []

    # Get ledger entries for all user accounts
    entries = await db.ledger_entries.find(
        {"account_id": {"$in": account_ids}}
    ).sort("created_at", -1).to_list(limit)

    result = []
    for e in entries:
        e.pop("_id", None)
        acc = account_map.get(e.get("account_id"), {})
        e["account_number"] = acc.get("account_number", "")
        e["iban"] = acc.get("iban", "")
        e["currency"] = acc.get("currency", "TRY")
        result.append(e)

    return result
