from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from datetime import datetime, timezone
from bson import ObjectId

from app.core.security import get_current_user
from app.core.database import get_database
from app.models.payment_request import PaymentRequestCreate, PaymentRequestResponse, PaymentRequestApprove
from app.services.ledger_service import PaymentService, PaymentDirection

router = APIRouter()

@router.post("/", response_model=PaymentRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_request(
    request: Request,
    req_body: PaymentRequestCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    requester_user_id = current_user["id"]
    
    # Needs to determine target user
    target_user_id = None
    target_name = None
    target_alias = req_body.target_alias
    
    # 1. Lookup Easy Addresses
    easy_addr = await db.easy_addresses.find_one({"alias_value": target_alias})
    if easy_addr:
        target_account_id = easy_addr["account_id"]
        target_account = await db.accounts.find_one({"_id": ObjectId(target_account_id)})
        if target_account:
            target_user_id = target_account["user_id"]
            cust = await db.customers.find_one({"user_id": target_user_id})
            target_name = cust.get("full_name") if cust else "Unknown"

    # 2. Lookup Customers explicitly
    if not target_user_id:
        cust = await db.customers.find_one({"$or": [{"phone": target_alias}, {"national_id": target_alias}]})
        if cust:
            target_user_id = cust["user_id"]
            target_name = cust.get("full_name")
            
    # 3. Lookup via Supabase email (skipped for brevity unless explicitly requested, 1 & 2 cover most scenarios)
    # We can try to lookup customer directly where user_id might map to email if we sync it. 
    # For now, if no target user is found:
    if not target_user_id:
        raise HTTPException(status_code=404, detail="Hedef kullanıcı bulunamadı. Lütfen geçerli bir telefon, TC Kimlik veya Kolay Adres girin.")
        
    if target_user_id == requester_user_id:
        raise HTTPException(status_code=400, detail="Kendinizden ödeme isteyemezsiniz.")

    requester_cust = await db.customers.find_one({"user_id": requester_user_id})
    requester_name = requester_cust.get("full_name") if requester_cust else "Unknown"

    request_doc = {
        "requester_user_id": requester_user_id,
        "requester_name": requester_name,
        "target_user_id": target_user_id,
        "target_name": target_name,
        "amount": req_body.amount,
        "description": req_body.description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    result = await db.payment_requests.insert_one(request_doc)
    request_doc["request_id"] = str(result.inserted_id)

    return request_doc

@router.get("/", response_model=List[PaymentRequestResponse])
async def list_payment_requests(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    user_id = current_user["id"]
    cursor = db.payment_requests.find(
        {"$or": [{"requester_user_id": user_id}, {"target_user_id": user_id}]}
    ).sort("created_at", -1)
    
    requests = []
    async for req in cursor:
        req["request_id"] = str(req.pop("_id"))
        requests.append(req)
        
    return requests

@router.post("/{request_id}/approve")
async def approve_payment_request(
    request_id: str,
    body: PaymentRequestApprove,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    user_id = current_user["id"]
    
    req_doc = await db.payment_requests.find_one({"_id": ObjectId(request_id)})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Ödeme isteği bulunamadı.")
        
    if req_doc["target_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Sadece sizden istenen ödemeleri onaylayabilirsiniz.")
        
    if req_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu istek zaten yanıtlanmış.")

    # Get from account
    from_account = await db.accounts.find_one({"_id": ObjectId(body.account_id), "user_id": user_id})
    if not from_account:
        raise HTTPException(status_code=404, detail="Geçersiz hesap.")

    # Find a receiving account for requester
    to_account = await db.accounts.find_one({"user_id": req_doc["requester_user_id"], "status": "active"})
    if not to_account:
        raise HTTPException(status_code=400, detail="Alıcının aktif bir hesabı bulunmuyor.")

    # Atomically lock the request to prevent double-approvals
    updated_req = await db.payment_requests.find_one_and_update(
        {"_id": ObjectId(request_id), "status": "pending"},
        {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}}
    )
    if not updated_req:
        raise HTTPException(status_code=400, detail="Bu istek zaten yanıtlanmış veya geçersiz duruma gelmiş.")

    # Execute transfer using Ledger (or regular transfer logic)
    from app.services.ledger_service import LedgerService
    ledger_service = LedgerService(db)
    
    # Perform transfer in ledger atomically
    try:
        await ledger_service.execute_transfer(
            from_account_id=str(from_account["_id"]),
            to_account_id=str(to_account["_id"]),
            amount=float(req_doc["amount"]),
            created_by=user_id,
            description=f"Ödeme İsteği Onaylandı: {req_doc['description']}"
        )
        
        # update Status
        await db.payment_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "paid", "updated_at": datetime.now(timezone.utc)}}
        )
        return {"detail": "Ödeme onaylandı ve transfer gerçekleştirildi."}
    except Exception as e:
        # Revert status on failure
        await db.payment_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "pending", "updated_at": datetime.now(timezone.utc)}}
        )
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{request_id}/reject")
async def reject_payment_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    req_doc = await db.payment_requests.find_one({"_id": ObjectId(request_id)})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Ödeme isteği bulunamadı.")
        
    if req_doc["target_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
        
    if req_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Yalnızca bekleyen istekler reddedilebilir.")

    await db.payment_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"detail": "Ödeme isteği reddedildi."}

@router.post("/{request_id}/cancel")
async def cancel_payment_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    req_doc = await db.payment_requests.find_one({"_id": ObjectId(request_id)})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Ödeme isteği bulunamadı.")
        
    if req_doc["requester_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
        
    if req_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Yalnızca bekleyen istekler iptal edilebilir.")

    await db.payment_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"detail": "Ödeme isteği iptal edildi."}
