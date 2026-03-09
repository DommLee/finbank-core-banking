"""
FinBank - Multi-Layer Approvals API Routes
"""
from datetime import datetime, timezone
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from bson.objectid import ObjectId

from app.core.database import get_database
from app.core.security import get_current_user
from app.models.approval import ApprovalRequestCreate, ApprovalResponse, ApprovalActionRequest
from app.services.audit_service import log_audit, get_client_info

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def _serialize_approval(doc: dict) -> ApprovalResponse:
    """Convert DB doc to Pydantic response."""
    doc["id"] = str(doc.pop("_id"))
    return ApprovalResponse(**doc)


def _generate_mock_ai_risk_score(amount: float, total_balance: float) -> str:
    """Simulate an AI risk engine using actual account balances."""
    if not amount:
        return "LOW"
    
    # If they are asking for more than 5x their total current balance, highly risky
    if amount > (total_balance * 5) or amount > 500000:
        return "HIGH"
    # If they are asking for more than 2x their total balance, moderately risky
    elif amount > (total_balance * 2) or amount > 50000:
        return "MEDIUM"
    
    return "LOW"


@router.post("/", response_model=ApprovalResponse)
async def create_approval(
    body: ApprovalRequestCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Submit a request that requires multi-layer approval.
    (e.g., Credit Limit Increase, High-Value Transfer).
    """
    
    # Check if a pending request of this type already exists for the user
    existing = await db.approvals.find_one({
        "user_id": current_user["user_id"],
        "request_type": body.request_type,
        "status": {"$in": ["PENDING_EMPLOYER", "PENDING_CEO"]}
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"You already have a pending {body.request_type} request."
        )

    # Fetch actual account balances to feed the deterministic risk engine
    accounts = await db.accounts.find({
        "user_id": current_user["user_id"],
        "status": "active"
    }).to_list(100)
    total_balance = sum(acc.get("balance", 0) for acc in accounts)

    risk_score = _generate_mock_ai_risk_score(body.amount or 0, total_balance)
    
    now = datetime.now(timezone.utc)
    approval_doc = {
        "user_id": current_user["user_id"],
        "user_name": current_user.get("full_name", current_user["email"]),
        "request_type": body.request_type,
        "amount": body.amount,
        "currency": body.currency,
        "description": body.description,
        "status": "PENDING_EMPLOYER",
        "risk_score": risk_score,
        "metadata": body.metadata,
        "created_at": now,
        "updated_at": now,
        "employer_notes": None,
        "ceo_notes": None
    }

    result = await db.approvals.insert_one(approval_doc)
    approval_doc["_id"] = result.inserted_id

    ip, ua = get_client_info(request)
    await log_audit(
        action="APPROVAL_REQUESTED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Requested {body.request_type} for amount {body.amount}. Risk Score: {risk_score}",
        ip_address=ip,
        user_agent=ua,
    )

    return _serialize_approval(approval_doc)


@router.get("/", response_model=List[ApprovalResponse])
async def list_approvals(
    status: Optional[str] = Query(None, description="Filter by status, e.g., PENDING_EMPLOYER"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    List approvals.
    - Customers: See only their own.
    - Employees/Admins: See PENDING_EMPLOYER (or all).
    - CEOs: See PENDING_CEO (or all).
    """
    query = {}
    
    if current_user["role"] == "customer":
        query["user_id"] = current_user["user_id"]
    elif current_user["role"] in ["admin", "employee"]:
        if status:
            query["status"] = status
        else:
            # By default, employees care about PENDING_EMPLOYER
            query["status"] = "PENDING_EMPLOYER"
    elif current_user["role"] == "ceo":
        if status:
            query["status"] = status
        else:
            # By default, CEOs care about PENDING_CEO
            query["status"] = "PENDING_CEO"

    cursor = db.approvals.find(query).sort("created_at", -1)
    results = await cursor.to_list(length=100)
    
    return [_serialize_approval(doc) for doc in results]


@router.patch("/{approval_id}/review", response_model=ApprovalResponse)
async def review_approval(
    approval_id: str,
    action: ApprovalActionRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Review a pending approval (Employer or CEO).
    """
    if current_user["role"] == "customer":
        raise HTTPException(status_code=403, detail="Customers cannot review approvals.")
        
    try:
        obj_id = ObjectId(approval_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid approval ID.")

    approval = await db.approvals.find_one({"_id": obj_id})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    current_status = approval["status"]
    if current_status not in ["PENDING_EMPLOYER", "PENDING_CEO"]:
        raise HTTPException(status_code=400, detail=f"Cannot review request in {current_status} state.")

    now = datetime.now(timezone.utc)
    update_data = {"updated_at": now}
    new_status = current_status

    if action.action == "REJECT":
        new_status = "REJECTED"
        if current_status == "PENDING_EMPLOYER":
            update_data["employer_notes"] = action.notes
        else:
            update_data["ceo_notes"] = action.notes
    
    elif action.action == "APPROVE":
        if current_status == "PENDING_EMPLOYER":
            if current_user["role"] in ["employee", "admin"]:
                if approval.get("request_type") == "DEPOSIT":
                    new_status = "APPROVED"
                    update_data["employer_notes"] = action.notes
                    
                    from app.services.ledger_service import LedgerService
                    ledger = LedgerService(db)
                    await ledger.deposit(
                        account_id=approval.get("metadata", {}).get("account_id"),
                        amount=approval.get("amount"),
                        created_by=approval.get("user_id"),
                        description=approval.get("description") or "Approved Deposit"
                    )
                else:
                    new_status = "PENDING_CEO"
                    update_data["employer_notes"] = action.notes
            else:
                raise HTTPException(status_code=403, detail="Only Employees/Admins can do Employer approvals.")
        
        elif current_status == "PENDING_CEO":
            if current_user["role"] == "ceo":
                new_status = "APPROVED"
                update_data["ceo_notes"] = action.notes
                
                # Execute Business Logic upon Final Approval
                if approval.get("request_type") == "CREDIT_LIMIT_INCREASE":
                    card_id = approval.get("metadata", {}).get("card_id")
                    requested_limit = approval.get("amount")
                    if card_id and requested_limit:
                        card = await db.credit_cards.find_one({"id": card_id})
                        if card:
                            old_limit = card.get("limit", 0)
                            difference = requested_limit - old_limit
                            if difference > 0:
                                await db.credit_cards.update_one(
                                    {"id": card_id},
                                    {
                                        "$set": {"limit": requested_limit, "updated_at": now},
                                        "$inc": {"available_limit": difference}
                                    }
                                )
            else:
                raise HTTPException(status_code=403, detail="Only CEOs can give final approvals.")

    update_data["status"] = new_status

    await db.approvals.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    # Re-fetch for response
    updated_doc = await db.approvals.find_one({"_id": obj_id})
    
    ip, ua = get_client_info(request)
    await log_audit(
        action="APPROVAL_REVIEWED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Reviewed {approval['request_type']} ({action.action}). Old Status: {current_status}, New Status: {new_status}",
        ip_address=ip,
        user_agent=ua,
    )
    
    # Ideally: If APPROVED, we might conditionally execute business logic (like updating credit limit).
    # For MVP context here, updating the status suffices for multi-layer demonstration.

    return _serialize_approval(updated_doc)
