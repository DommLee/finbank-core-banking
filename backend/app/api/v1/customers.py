"""
FinBank - Customer & KYC API Routes
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.database import get_database
from app.core.security import get_current_user, require_admin, require_staff
from app.models.customer import (
    CustomerCreateRequest, CustomerUpdateRequest,
    CustomerStatusUpdate, CustomerResponse,
)
from app.services.audit_service import log_audit, get_client_info
from app.services.supabase_sync import sync_customer

router = APIRouter(prefix="/customers", tags=["Customers & KYC"])


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    body: CustomerCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a customer profile (KYC mock)."""
    # Check if customer already exists for this user
    existing = await db.customers.find_one({"user_id": current_user["user_id"]})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer profile already exists for this user",
        )

    # Check if national_id is already registered
    existing_id = await db.customers.find_one({"national_id": body.national_id})
    if existing_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="National ID already registered",
        )

    customer_doc = {
        "customer_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "full_name": body.full_name,
        "national_id": body.national_id,
        "phone": body.phone,
        "date_of_birth": body.date_of_birth.isoformat() if body.date_of_birth else None,
        "address": body.address,
        "status": "pending",
        "kyc_verified": False,
        "id_front_url": body.id_front_url,
        "id_back_url": body.id_back_url,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.customers.insert_one(customer_doc)
    await sync_customer(customer_doc)

    ip, ua = get_client_info(request)
    await log_audit(
        action="CUSTOMER_CREATED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Customer created: {body.full_name}",
        ip_address=ip,
        user_agent=ua,
    )

    return CustomerResponse(
        id=customer_doc["customer_id"],
        user_id=customer_doc["user_id"],
        full_name=customer_doc["full_name"],
        national_id=customer_doc["national_id"],
        phone=customer_doc["phone"],
        date_of_birth=customer_doc["date_of_birth"],
        address=customer_doc["address"],
        id_front_url=customer_doc.get("id_front_url"),
        id_back_url=customer_doc.get("id_back_url"),
        status=customer_doc["status"],
        kyc_verified=customer_doc["kyc_verified"],
        created_at=customer_doc["created_at"],
    )


@router.get("/me", response_model=CustomerResponse)
async def get_my_customer(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get the current user's customer profile."""
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    return CustomerResponse(
        id=customer["customer_id"],
        user_id=customer["user_id"],
        full_name=customer["full_name"],
        national_id=customer["national_id"],
        phone=customer["phone"],
        date_of_birth=customer["date_of_birth"],
        address=customer.get("address"),
        id_front_url=customer.get("id_front_url"),
        id_back_url=customer.get("id_back_url"),
        status=customer["status"],
        kyc_verified=customer["kyc_verified"],
        created_at=customer["created_at"],
    )


@router.put("/me", response_model=CustomerResponse)
async def update_my_customer(
    body: CustomerUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Update the current user's customer profile."""
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {"$set": update_data},
    )

    ip, ua = get_client_info(request)
    await log_audit(
        action="CUSTOMER_UPDATED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Updated fields: {list(update_data.keys())}",
        ip_address=ip,
        user_agent=ua,
    )

    updated = await db.customers.find_one({"customer_id": customer["customer_id"]})
    return CustomerResponse(
        id=updated["customer_id"],
        user_id=updated["user_id"],
        full_name=updated["full_name"],
        national_id=updated["national_id"],
        phone=updated["phone"],
        date_of_birth=updated["date_of_birth"],
        address=updated.get("address"),
        id_front_url=updated.get("id_front_url"),
        id_back_url=updated.get("id_back_url"),
        status=updated["status"],
        kyc_verified=updated["kyc_verified"],
        created_at=updated["created_at"],
    )


# ── Admin Routes ──

@router.get("/", response_model=list[CustomerResponse])
async def list_all_customers(
    current_user: dict = Depends(require_staff),
    db=Depends(get_database),
):
    """Staff: List all customers."""
    cursor = db.customers.find().sort("created_at", -1)
    customers = await cursor.to_list(100)
    return [
        CustomerResponse(
            id=c["customer_id"],
            user_id=c["user_id"],
            full_name=c["full_name"],
            national_id=c["national_id"],
            phone=c["phone"],
            date_of_birth=c["date_of_birth"],
            address=c.get("address"),
            id_front_url=c.get("id_front_url"),
            id_back_url=c.get("id_back_url"),
            status=c["status"],
            kyc_verified=c["kyc_verified"],
            created_at=c["created_at"],
        )
        for c in customers
    ]


@router.patch("/{customer_id}/status", response_model=CustomerResponse)
async def update_customer_status(
    customer_id: str,
    body: CustomerStatusUpdate,
    request: Request,
    current_user: dict = Depends(require_staff),
    db=Depends(get_database),
):
    """Staff: Update customer status & KYC verification."""
    customer = await db.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_fields = {"status": body.status.value, "updated_at": datetime.now(timezone.utc)}
    if body.kyc_verified is not None:
        update_fields["kyc_verified"] = body.kyc_verified

    await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": update_fields},
    )

    # Update corresponding user doc to reflect KYC approval
    user_kyc_status = "APPROVED" if body.status.value == "active" else "REJECTED"
    await db.users.update_one(
        {"user_id": customer["user_id"]},
        {"$set": {"kyc_status": user_kyc_status}}
    )
    # Sync updated user doc to Supabase
    updated_user = await db.users.find_one({"user_id": customer["user_id"]})
    from app.services.supabase_sync import sync_user
    if updated_user:
        await sync_user(updated_user)

    ip, ua = get_client_info(request)
    await log_audit(
        action="KYC_STATUS_UPDATED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details=f"Customer {customer_id} status → {body.status.value}, KYC verified: {body.kyc_verified}",
        ip_address=ip,
        user_agent=ua,
    )

    updated = await db.customers.find_one({"customer_id": customer_id})
    return CustomerResponse(
        id=updated["customer_id"],
        user_id=updated["user_id"],
        full_name=updated["full_name"],
        national_id=updated["national_id"],
        phone=updated["phone"],
        date_of_birth=updated["date_of_birth"],
        address=updated.get("address"),
        id_front_url=updated.get("id_front_url"),
        id_back_url=updated.get("id_back_url"),
        status=updated["status"],
        kyc_verified=updated["kyc_verified"],
        created_at=updated["created_at"],
    )
