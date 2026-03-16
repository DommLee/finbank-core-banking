"""
FinBank Banking Service - Accounts, transfers, cards, bills and customer data.
Port: 8002
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
import os
import random
import sys
import uuid

import asyncio
import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import settings
from shared.database import close_mongo_connection, connect_to_mongo, get_database
from shared.jwt_utils import get_current_user, require_admin

from app.utils.iso20022 import (
    generate_pacs002_xml,
    generate_pacs008_xml,
    parse_pacs002_xml,
    parse_pacs008_xml,
)
import websockets

# Central GitHub Registry URL for banks. Change this to a real raw githubusercontent URL when ready!
BANK_REGISTRY_URL = os.environ.get("BANK_REGISTRY_URL", "https://raw.githubusercontent.com/example/bank-registry/main/banks.json")

# Starts empty, will be populated on startup
EXTERNAL_BANKS = {}

MY_BANK_CODE = "FINB"

SUPPORTED_ACCOUNT_TYPES = {"checking", "savings"}
SUPPORTED_CURRENCIES = {"TRY", "USD", "EUR"}
STAFF_ROLES = {"employee", "admin", "ceo"}
CARD_INTEREST_RATE = 3.29
CARD_MIN_PAYMENT_RATIO = 0.20
MOCK_RATES = {"USD": 32.50, "EUR": 35.20, "GBP": 41.10, "TRY": 1.0}
NOTIFICATION_SERVICE_URL = os.environ.get("NOTIFICATION_SERVICE_URL", "http://notification-service:8003")

async def fetch_external_banks():
    """
    Uygulama baslarken ortak GitHub (veya sunucu) repository'sindeki
    bankalar listesi (JSON) cekilir ve EXTERNAL_BANKS sozlugune kaydedilir.
    """
    global EXTERNAL_BANKS
    try:
        if BANK_REGISTRY_URL.startswith("http"):
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(BANK_REGISTRY_URL)
                if response.status_code == 200:
                    data = response.json()
                    EXTERNAL_BANKS = {k: v for k, v in data.items() if isinstance(v, str)}
                    print(f"[Init] Dis banka kayitlari basariyla cekildi: {len(EXTERNAL_BANKS)} banka bulundu.")
                else:
                    print(f"[Init Warning] Banka kayitlarini cekerken hata olustu: HTTP {response.status_code}")
        else:
             print("[Init] Gecerli bir BANK_REGISTRY_URL bulunamadi, dis banka erisimi kapali (veya fallback mod).")
    except Exception as e:
        print(f"[Init Error] Dis banka listesi alinirken hata: {e}")

    # Eger hic cekilemediyse, fallback olarak testleri aktif tutmak isterseniz:
    if not EXTERNAL_BANKS:
        EXTERNAL_BANKS = {
             "DGBNK": "ws://127.0.0.1:8002/ws/inter-bank/FINB", 
             "TEST": "ws://127.0.0.1:8002/ws/inter-bank/FINB"
        }
        print("[Init] Dis bankalar bos oldugu icin Test bankalari aktif edildi.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    connect_to_mongo()
    await fetch_external_banks()
    yield
    # Shutdown actions
    close_mongo_connection()

app = FastAPI(title="FinBank Banking Service", lifespan=lifespan)


class CustomerCreateRequest(BaseModel):
    full_name: str
    national_id: str
    phone: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = None


class CustomerUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None


class CustomerStatusUpdateRequest(BaseModel):
    status: str
    kyc_verified: Optional[bool] = None


class KYCSubmissionRequest(BaseModel):
    first_name: str
    last_name: str
    national_id: str
    phone: str
    birth_date: Optional[str] = None
    address: Optional[str] = None
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None


class AccountCreateRequest(BaseModel):
    account_type: str = "checking"
    currency: str = "TRY"


class DepositRequest(BaseModel):
    account_id: str
    amount: float
    description: Optional[str] = None


class WithdrawRequest(BaseModel):
    account_id: str
    amount: float
    description: Optional[str] = None


class TransferRequest(BaseModel):
    from_account_id: str
    to_account_id: Optional[str] = None
    target_iban: Optional[str] = None
    target_alias: Optional[str] = None
    amount: float
    description: Optional[str] = None


class EasyAddressCreateRequest(BaseModel):
    account_id: str
    alias_type: str
    alias_value: str
    label: Optional[str] = None


class BillPayRequest(BaseModel):
    account_id: str
    bill_type: str
    provider: str
    subscriber_no: str
    amount: float


class GoalCreateRequest(BaseModel):
    name: str
    target_amount: float
    deadline: Optional[str] = None


class GoalContributeRequest(BaseModel):
    account_id: str
    amount: float


class CardPaymentRequest(BaseModel):
    from_account_id: str
    amount: float


class CardApplicationRequest(BaseModel):
    requested_limit: Optional[float] = Field(default=None, gt=0)


class VirtualCardCreateRequest(BaseModel):
    alias: Optional[str] = None
    online_limit: Optional[float] = Field(default=None, gt=0)


class CardSettingsUpdateRequest(BaseModel):
    internet_enabled: Optional[bool] = None
    contactless_enabled: Optional[bool] = None
    overseas_enabled: Optional[bool] = None
    online_limit: Optional[float] = Field(default=None, gt=0)


class PaymentRequestCreate(BaseModel):
    target_alias: str
    amount: float = Field(..., gt=0)
    description: str


class PaymentRequestAction(BaseModel):
    account_id: str

class AutoBillPaymentCreate(BaseModel):
    account_id: str
    bill_type: str
    provider: str
    subscriber_no: str
    max_amount: Optional[float] = None
    payment_day: int = Field(..., ge=1, le=31)

class CardApply(BaseModel):
    account_id: str
    card_type: str = "debit" # 'credit' or 'debit'

class VirtualCardCreate(BaseModel):
    account_id: str
    limit: Optional[float] = None

class CardSettingsUpdate(BaseModel):
    internet_shopping: Optional[bool] = None
    contactless: Optional[bool] = None

class CardPayDebt(BaseModel):
    from_account_id: str
    amount: float

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    await db.accounts.create_index("account_number", unique=True)
    await db.accounts.create_index("iban", unique=True)
    await db.accounts.create_index("customer_id")
    await db.accounts.create_index("user_id")
    await db.customers.create_index("national_id", unique=True, sparse=True)
    await db.customers.create_index("user_id", unique=True)
    await db.ledger_entries.create_index([("transaction_ref", 1), ("account_id", 1), ("type", 1)], unique=True)
    await db.ledger_entries.create_index("account_id")
    await db.ledger_entries.create_index("created_at")
    await db.bills.create_index("user_id")
    await db.bills.create_index("paid_at")
    await db.savings_goals.create_index("user_id")
    await db.payment_requests.create_index("requester_user_id")
    await db.payment_requests.create_index("target_user_id")
    try:
        await db.credit_cards.drop_index("user_id_1")
    except Exception:
        pass
    await db.credit_cards.create_index("user_id")
    await db.credit_cards.create_index("card_number", unique=True)
    await db.credit_cards.create_index("is_virtual")
    await db.credit_cards.create_index("parent_card_id")
    await db.card_transactions.create_index("card_id")
    await db.card_transactions.create_index("created_at")
    await db.easy_addresses.create_index("user_id")
    await db.easy_addresses.create_index("account_id")
    await db.easy_addresses.create_index("alias_value_normalized", unique=True)
    # Index for auto_bill_payments
    await db.auto_bill_payments.create_index([("user_id", 1), ("status", 1)])
    
    # Start background task for auto bills
    task = asyncio.create_task(process_auto_bills_loop(db))
    
    try:
        yield
    except Exception as e:
        print(f"MongoDB connection error: {e}", file=sys.stderr)
        yield
    finally:
        task.cancel()
        await close_mongo_connection()

async def process_auto_bills_loop(db):
    """
    Every 1 hour, checks if it's 10:00 AM UTC and processes bills.
    For demonstration purposes, if `DEBUG` is true, we could run it more often,
    but checking once an hour for `payment_day` matching today's day is standard.
    """
    while True:
        try:
            now = now_utc()
            # Try to process auto bills if it's the right day
            # Normally we should ensure we only run this once per day, 
            # here we'll just check if it's between 08:00 and 09:00 UTC 
            # and rely on a 'last_processed_date' or just simplicity for the demo.
            if 8 <= now.hour <= 10:
                today_day = now.day
                active_orders = await db.auto_bill_payments.find({
                    "status": "active",
                    "payment_day": today_day,
                }).to_list(1000)

                for order in active_orders:
                    # check if already paid this month
                    last_paid = order.get("last_paid_date")
                    if last_paid and last_paid[:7] == now.strftime("%Y-%m"):
                        continue
                        
                    account = await db.accounts.find_one({"account_id": order["account_id"]})
                    if not account:
                        continue
                        
                    # Calculate amount to pay
                    # Mock: random amount between 100 - max_amount
                    max_amt = float(order.get("max_amount") or 500.0)
                    amount_to_pay = min(max_amt, random.uniform(100.0, max_amt))
                    
                    if float(account.get("balance", 0)) >= amount_to_pay:
                        txn_ref = f"AUTOBILL-{uuid.uuid4().hex[:8].upper()}"
                        await create_ledger_entry(
                            db,
                            account["account_id"],
                            "DEBIT",
                            "AUTO_BILL_PAYMENT",
                            amount_to_pay,
                            txn_ref,
                            order["user_id"],
                            f"Otomatik Fatura: {order['provider']} / {order['subscriber_no']}",
                        )
                        # Mark as paid this month
                        await db.auto_bill_payments.update_one(
                            {"_id": order["_id"]},
                            {"$set": {"last_paid_date": now.strftime("%Y-%m-%d")}}
                        )
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in process_auto_bills_loop: {e}", file=sys.stderr)
            
        await asyncio.sleep(3600)  # Sleep 1 hour



app = FastAPI(title="FinBank Banking Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_positive_amount(amount: float) -> None:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tutar sifirdan buyuk olmali.")


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in full_name.strip().split() if part]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def validate_turkish_identity_number(national_id: str) -> str:
    tc = (national_id or "").strip()
    if len(tc) != 11 or not tc.isdigit() or tc[0] == "0":
        raise HTTPException(status_code=400, detail="Gecersiz TC Kimlik numarasi.")

    digits = [int(char) for char in tc]
    odd_sum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
    even_sum = digits[1] + digits[3] + digits[5] + digits[7]
    if ((odd_sum * 7) - even_sum) % 10 != digits[9]:
        raise HTTPException(status_code=400, detail="TC Kimlik numarasi dogrulanamadi.")
    if sum(digits[:10]) % 10 != digits[10]:
        raise HTTPException(status_code=400, detail="TC Kimlik numarasi dogrulanamadi.")
    return tc


def require_staff_access(current_user: dict) -> None:
    if current_user.get("role") not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Bu islem icin yetkiniz yok.")


def user_kyc_status_for_customer_status(status: str) -> str:
    normalized = (status or "").lower()
    if normalized == "active":
        return "APPROVED"
    if normalized in {"rejected", "suspended"}:
        return "REJECTED"
    return "PENDING"


async def get_balance(db, account_id: str) -> float:
    pipeline = [
        {"$match": {"account_id": account_id}},
        {
            "$group": {
                "_id": None,
                "total": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$type", "CREDIT"]},
                            "$amount",
                            {"$multiply": ["$amount", -1]},
                        ]
                    }
                },
            }
        },
    ]
    result = await db.ledger_entries.aggregate(pipeline).to_list(1)
    return float(result[0]["total"]) if result else 0.0


async def create_ledger_entry(
    db,
    account_id: str,
    entry_type: str,
    category: str,
    amount: float,
    txn_ref: str,
    created_by: str,
    description: str = "",
    metadata: Optional[dict] = None,
):
    entry = {
        "entry_id": str(uuid.uuid4()),
        "account_id": account_id,
        "type": entry_type,
        "category": category,
        "amount": float(amount),
        "transaction_ref": txn_ref,
        "description": description,
        "created_at": now_utc(),
        "created_by": created_by,
    }
    if metadata:
        entry.update(metadata)
    await db.ledger_entries.insert_one(entry)
    return entry


async def get_account_or_404(db, account_id: str) -> dict:
    account = await db.accounts.find_one({"account_id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Hesap bulunamadi.")
    return account


async def get_card_or_404(db, card_id: str) -> dict:
    card = await db.credit_cards.find_one({"card_id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Kart bulunamadi.")
    return card


def ensure_account_access(current_user: dict, account: dict, allow_staff: bool = False) -> None:
    if account.get("user_id") == current_user.get("user_id"):
        return
    if current_user.get("role") == "admin":
        return
    if allow_staff and current_user.get("role") in STAFF_ROLES:
        return
    raise HTTPException(status_code=403, detail="Bu hesap icin yetkiniz yok.")


def ensure_card_access(current_user: dict, card: dict) -> None:
    if card.get("user_id") != current_user.get("user_id") and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bu kart icin yetkiniz yok.")


def serialize_customer(customer: Optional[dict]) -> Optional[dict]:
    if not customer:
        return None
    doc = dict(customer)
    doc["id"] = doc["customer_id"]
    doc.pop("_id", None)
    return doc


async def serialize_account(db, account: dict, include_balance: bool = True) -> dict:
    doc = dict(account)
    doc["id"] = doc["account_id"]
    doc.pop("_id", None)
    if include_balance:
        doc["balance"] = await get_balance(db, doc["account_id"])
    return doc


def serialize_ledger_entry(entry: dict) -> dict:
    doc = dict(entry)
    doc["id"] = doc["entry_id"]
    doc["direction"] = doc.get("type")
    doc.pop("_id", None)
    return doc


def serialize_card(card: dict) -> dict:
    doc = dict(card)
    doc["id"] = doc["card_id"]
    doc.pop("_id", None)
    return doc


def serialize_card_transaction(transaction: dict) -> dict:
    doc = dict(transaction)
    doc["id"] = doc["transaction_id"]
    doc.pop("_id", None)
    return doc


def serialize_bill(bill: dict) -> dict:
    doc = dict(bill)
    doc["id"] = doc["bill_id"]
    doc.pop("_id", None)
    return doc


def serialize_goal(goal: dict) -> dict:
    doc = dict(goal)
    doc["id"] = doc["goal_id"]
    doc.pop("_id", None)
    return doc


def serialize_easy_address(address: dict, account: Optional[dict] = None) -> dict:
    doc = dict(address)
    doc["id"] = doc["easy_address_id"]
    doc.pop("_id", None)
    if account:
        doc["account"] = {
            "id": account["account_id"],
            "account_number": account["account_number"],
            "iban": account["iban"],
            "currency": account["currency"],
        }
    return doc


def normalize_alias_type(alias_type: str) -> str:
    normalized = (alias_type or "").strip().lower()
    if normalized in {"phone", "telefon", "gsm"}:
        return "phone"
    if normalized in {"email", "mail"}:
        return "email"
    if normalized in {"national_id", "identity", "tc", "tc_kimlik"}:
        return "national_id"
    raise HTTPException(status_code=400, detail="Gecersiz kolay adres tipi.")


def normalize_easy_address(alias_type: str, alias_value: str) -> tuple[str, str]:
    normalized_type = normalize_alias_type(alias_type)
    raw_value = (alias_value or "").strip()
    if not raw_value:
        raise HTTPException(status_code=400, detail="Kolay adres degeri zorunlu.")

    if normalized_type == "email":
        if "@" not in raw_value or "." not in raw_value.split("@")[-1]:
            raise HTTPException(status_code=400, detail="Gecersiz e-posta adresi.")
        return normalized_type, raw_value.lower()

    if normalized_type == "phone":
        digits = "".join(char for char in raw_value if char.isdigit())
        if digits.startswith("0"):
            digits = digits[1:]
        if len(digits) == 10:
            digits = f"90{digits}"
        if len(digits) != 12 or not digits.startswith("90"):
            raise HTTPException(status_code=400, detail="Gecersiz telefon numarasi.")
        return normalized_type, digits

    return normalized_type, validate_turkish_identity_number(raw_value)


def candidate_easy_address_values(raw_value: Optional[str]) -> list[str]:
    value = (raw_value or "").strip()
    if not value:
        return []
    candidates = [value, value.lower()]
    digits = "".join(char for char in value if char.isdigit())
    if digits:
        trimmed = digits[1:] if digits.startswith("0") else digits
        candidates.append(digits)
        candidates.append(trimmed)
        if len(trimmed) == 10:
            candidates.append(f"90{trimmed}")
    ordered = []
    for item in candidates:
        if item and item not in ordered:
            ordered.append(item)
    return ordered


def mask_easy_address(alias_type: str, alias_value: str) -> str:
    if alias_type == "email":
        local, _, domain = alias_value.partition("@")
        if len(local) <= 2:
            masked_local = local[0] + "*" if local else "*"
        else:
            masked_local = f"{local[:2]}***"
        return f"{masked_local}@{domain}"
    if alias_type == "phone":
        return f"+{alias_value[:2]} *** *** {alias_value[-4:]}"
    return f"***{alias_value[-4:]}"


def build_card_document(
    *,
    user_id: str,
    customer: dict,
    card_number: str,
    card_limit: float,
    card_name: str,
    is_virtual: bool,
    online_limit: Optional[float] = None,
    parent_card_id: Optional[str] = None,
) -> dict:
    limit_value = round(float(card_limit), 2)
    online_limit_value = round(min(float(online_limit or limit_value), limit_value), 2)
    return {
        "card_id": str(uuid.uuid4()),
        "user_id": user_id,
        "card_name": card_name,
        "card_number": card_number,
        "cardholder_name": cardholder_name_for_customer(customer),
        "expiry_date": build_expiry_date(3 if is_virtual else 5),
        "network": random.choice(["VISA", "MASTERCARD"]),
        "card_type": "virtual" if is_virtual else "credit",
        "is_virtual": is_virtual,
        "parent_card_id": parent_card_id,
        "limit": limit_value,
        "available_limit": limit_value,
        "current_debt": 0.0,
        "interest_rate": CARD_INTEREST_RATE,
        "min_payment_due": 0.0,
        "billing_day": 15,
        "due_day": 25,
        "internet_enabled": True,
        "contactless_enabled": not is_virtual,
        "overseas_enabled": False,
        "online_limit": online_limit_value,
        "status": "active",
        "created_at": now_utc(),
    }


async def generate_account_number(db) -> str:
    while True:
        account_number = f"{random.randint(1000000000, 9999999999)}"
        exists = await db.accounts.find_one({"account_number": account_number})
        if not exists:
            return account_number


def build_iban(account_number: str) -> str:
    return f"TR{random.randint(10,99)}000610{account_number.zfill(16)[:16]}"


def luhn_digit(number_without_check_digit: str) -> str:
    digits = [int(digit) for digit in number_without_check_digit]
    checksum = 0
    parity = (len(digits) + 1) % 2
    for index, digit in enumerate(digits):
        value = digit
        if index % 2 == parity:
            value *= 2
            if value > 9:
                value -= 9
        checksum += value
    return str((10 - (checksum % 10)) % 10)


async def generate_card_number(db) -> str:
    while True:
        base = "4500" + "".join(str(random.randint(0, 9)) for _ in range(11))
        card_number = base + luhn_digit(base)
        exists = await db.credit_cards.find_one({"card_number": card_number})
        if not exists:
            return card_number


def build_expiry_date(years: int = 5) -> str:
    now = now_utc()
    month = now.month
    year = (now.year + years) % 100
    return f"{month:02d}/{year:02d}"


async def resolve_target_account(db, body: TransferRequest) -> dict:
    identifiers = []
    if body.to_account_id:
        identifiers.append(body.to_account_id.strip())
    if body.target_alias:
        identifiers.append(body.target_alias.strip())

    for identifier in identifiers:
        if not identifier:
            continue
        account = await db.accounts.find_one({"$or": [{"account_id": identifier}, {"account_number": identifier}]})
        if account:
            account["is_external"] = False
            return account
        candidates = candidate_easy_address_values(identifier)
        if candidates:
            easy_address = await db.easy_addresses.find_one(
                {"alias_value_normalized": {"$in": candidates}, "status": "active"}
            )
            if easy_address:
                account = await db.accounts.find_one({"account_id": easy_address["account_id"]})
                if account:
                    account["is_external"] = False
                    return account

    if body.target_iban:
        account = await db.accounts.find_one({"iban": body.target_iban.strip()})
        if not account:
            # INTER-BANK LOGIC: If IBAN is not found in our DB, check if it belongs to another bank
            iban = body.target_iban.strip().upper()
            if iban.startswith("TR") and len(iban) > 10:
                # Let's say we check if it is explicitly NOT FinBank (e.g., our IBANs might start with TR11...)
                # For this assignment, we use a simple substring match for specific mock banks 
                
                mapped_bank_code = None
                if "DGBNK" in iban:
                    mapped_bank_code = "DGBNK"
                elif "TEST" in iban:
                    mapped_bank_code = "TEST"
                else:
                    mapped_bank_code = "DGBNK" # Default unknown to DGBNK for testing
                
                return {
                    "account_id": "EXTERNAL",
                    "iban": iban,
                    "status": "active",
                    "user_id": "EXTERNAL_USER",
                    "bank_code": mapped_bank_code,
                    "currency": "TRY", # Fallback default
                    "is_external": True
                }
            raise HTTPException(status_code=404, detail="IBAN ile hesap bulunamadi ve dis banka formati gecersiz.")
        account["is_external"] = False
        return account
    raise HTTPException(status_code=400, detail="Alici hesap, hesap numarasi, kolay adres veya IBAN zorunlu.")


def cardholder_name_for_customer(customer: dict) -> str:
    return (customer.get("full_name") or "FinBank Musterisi").upper()[:26]


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "banking-service"}


@app.post("/customers")
async def create_customer(body: CustomerCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    full_name = body.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Ad soyad en az 2 karakter olmali.")

    national_id = validate_turkish_identity_number(body.national_id)
    first_name, last_name = split_full_name(full_name)
    existing = await db.customers.find_one({"user_id": current_user["user_id"]})
    existing_tc = await db.customers.find_one({"national_id": national_id, "user_id": {"$ne": current_user["user_id"]}})
    if existing_tc:
        raise HTTPException(status_code=409, detail="Bu TC Kimlik ile baska bir musteri var.")

    created_at = existing.get("created_at") if existing else now_utc()
    document = {
        "customer_id": existing.get("customer_id") if existing else str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "full_name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "national_id": national_id,
        "phone": body.phone.strip(),
        "date_of_birth": body.date_of_birth,
        "address": body.address.strip() if body.address else None,
        "status": existing.get("status", "pending_kyc") if existing else "pending_kyc",
        "kyc_verified": existing.get("kyc_verified", False) if existing else False,
        "id_front_url": existing.get("id_front_url") if existing else None,
        "id_back_url": existing.get("id_back_url") if existing else None,
        "created_at": created_at,
        "updated_at": now_utc(),
    }
    await db.customers.update_one({"user_id": current_user["user_id"]}, {"$set": document}, upsert=True)
    return serialize_customer(document)


@app.get("/customers")
async def list_customers(
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    require_staff_access(current_user)
    query = {}
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"national_id": {"$regex": q, "$options": "i"}},
        ]
    skip = max(page - 1, 0) * limit
    customers = await db.customers.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.customers.count_documents(query)
    return {"data": [serialize_customer(customer) for customer in customers], "total": total, "page": page}


@app.get("/customers/me")
async def get_my_profile(current_user=Depends(get_current_user), db=Depends(get_database)):
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        return None
    return serialize_customer(customer)


@app.put("/customers/me")
async def update_my_profile(body: CustomerUpdateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri profili bulunamadi.")

    updates = {}
    if body.full_name:
        first_name, last_name = split_full_name(body.full_name)
        updates.update({"full_name": body.full_name.strip(), "first_name": first_name, "last_name": last_name})
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.date_of_birth is not None:
        updates["date_of_birth"] = body.date_of_birth
    if body.address is not None:
        updates["address"] = body.address.strip() if body.address else None
    updates["updated_at"] = now_utc()

    await db.customers.update_one({"user_id": current_user["user_id"]}, {"$set": updates})
    updated = await db.customers.find_one({"user_id": current_user["user_id"]})
    return serialize_customer(updated)


@app.post("/customers/kyc")
async def submit_kyc(body: KYCSubmissionRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    national_id = validate_turkish_identity_number(body.national_id)
    full_name = f"{body.first_name.strip()} {body.last_name.strip()}".strip()
    existing_tc = await db.customers.find_one({"national_id": national_id, "user_id": {"$ne": current_user["user_id"]}})
    if existing_tc:
        raise HTTPException(status_code=409, detail="Bu TC Kimlik ile baska bir musteri var.")

    existing = await db.customers.find_one({"user_id": current_user["user_id"]}) or {}
    document = {
        "customer_id": existing.get("customer_id", str(uuid.uuid4())),
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "full_name": full_name,
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "national_id": national_id,
        "phone": body.phone.strip(),
        "date_of_birth": body.birth_date,
        "address": body.address.strip() if body.address else None,
        "status": "pending_kyc",
        "kyc_verified": False,
        "id_front_url": body.id_front_url,
        "id_back_url": body.id_back_url,
        "created_at": existing.get("created_at", now_utc()),
        "updated_at": now_utc(),
    }
    await db.customers.update_one({"user_id": current_user["user_id"]}, {"$set": document}, upsert=True)
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$set": {"kyc_status": "PENDING"}})
    return {"message": "KYC basvurusu gonderildi.", "customer": serialize_customer(document)}


@app.patch("/customers/{customer_id}/status")
async def update_customer_status(
    customer_id: str,
    body: CustomerStatusUpdateRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    require_staff_access(current_user)
    customer = await db.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri bulunamadi.")

    reviewed_at = now_utc()
    updates = {
        "status": body.status,
        "kyc_verified": body.kyc_verified if body.kyc_verified is not None else body.status == "active",
        "updated_at": reviewed_at,
        "kyc_reviewed_by": current_user["email"],
        "kyc_reviewed_at": reviewed_at,
    }
    await db.customers.update_one({"customer_id": customer_id}, {"$set": updates})
    await db.users.update_one(
        {"user_id": customer["user_id"]},
        {"$set": {"kyc_status": user_kyc_status_for_customer_status(body.status)}},
    )
    updated = await db.customers.find_one({"customer_id": customer_id})
    return serialize_customer(updated)


@app.post("/accounts")
async def create_account(body: AccountCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    if body.account_type not in SUPPORTED_ACCOUNT_TYPES:
        raise HTTPException(status_code=400, detail="Gecersiz hesap tipi.")
    if body.currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Gecersiz para birimi.")

    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=400, detail="Once musteri profilinizi tamamlayin.")
    if customer.get("status") != "active":
        raise HTTPException(status_code=403, detail="KYC onayi olmadan hesap acilamaz.")

    account_number = await generate_account_number(db)
    document = {
        "account_id": str(uuid.uuid4()),
        "account_number": account_number,
        "iban": build_iban(account_number),
        "customer_id": customer["customer_id"],
        "user_id": current_user["user_id"],
        "account_type": body.account_type,
        "currency": body.currency,
        "status": "active",
        "created_at": now_utc(),
    }
    await db.accounts.insert_one(document)
    return await serialize_account(db, document)


@app.get("/accounts")
async def list_my_accounts(current_user=Depends(get_current_user), db=Depends(get_database)):
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    return [await serialize_account(db, account) for account in accounts]


@app.get("/accounts/all")
async def list_all_accounts(current_user=Depends(require_admin), db=Depends(get_database)):
    accounts = await db.accounts.find().sort("created_at", -1).to_list(200)
    return [await serialize_account(db, account) for account in accounts]


@app.get("/accounts/customer/{customer_id}")
async def list_accounts_by_customer(customer_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_staff_access(current_user)
    accounts = await db.accounts.find({"customer_id": customer_id}).sort("created_at", -1).to_list(50)
    return [await serialize_account(db, account) for account in accounts]


@app.get("/accounts/debit-cards")
async def list_debit_cards(current_user=Depends(get_current_user), db=Depends(get_database)):
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    return [await serialize_account(db, account, include_balance=False) for account in accounts]


@app.get("/accounts/easy-addresses")
async def list_easy_addresses(current_user=Depends(get_current_user), db=Depends(get_database)):
    easy_addresses = await db.easy_addresses.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    results = []
    for easy_address in easy_addresses:
        account = await db.accounts.find_one({"account_id": easy_address["account_id"]})
        serialized = serialize_easy_address(easy_address, account)
        serialized["masked_value"] = mask_easy_address(serialized["alias_type"], serialized["alias_value"])
        results.append(serialized)
    return results


@app.post("/accounts/easy-addresses")
async def create_easy_address(body: EasyAddressCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, account, allow_staff=False)
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Kolay adres icin aktif hesap gerekli.")

    alias_type, normalized_value = normalize_easy_address(body.alias_type, body.alias_value)
    existing = await db.easy_addresses.find_one({"alias_value_normalized": normalized_value})
    if existing and existing.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=409, detail="Bu kolay adres baska bir hesapta kullaniliyor.")

    if existing and existing.get("account_id") == account["account_id"]:
        await db.easy_addresses.update_one(
            {"easy_address_id": existing["easy_address_id"]},
            {"$set": {"label": body.label or existing.get("label") or normalized_value, "status": "active"}},
        )
        updated = await db.easy_addresses.find_one({"easy_address_id": existing["easy_address_id"]})
        serialized = serialize_easy_address(updated, account)
        serialized["masked_value"] = mask_easy_address(serialized["alias_type"], serialized["alias_value"])
        return serialized

    document = {
        "easy_address_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "customer_id": account["customer_id"],
        "account_id": account["account_id"],
        "alias_type": alias_type,
        "alias_value": body.alias_value.strip(),
        "alias_value_normalized": normalized_value,
        "label": (body.label or normalized_value).strip(),
        "status": "active",
        "created_at": now_utc(),
    }
    await db.easy_addresses.insert_one(document)
    serialized = serialize_easy_address(document, account)
    serialized["masked_value"] = mask_easy_address(serialized["alias_type"], serialized["alias_value"])
    return serialized


@app.delete("/accounts/easy-addresses/{easy_address_id}")
async def delete_easy_address(easy_address_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    easy_address = await db.easy_addresses.find_one({"easy_address_id": easy_address_id, "user_id": current_user["user_id"]})
    if not easy_address:
        raise HTTPException(status_code=404, detail="Kolay adres bulunamadi.")
    await db.easy_addresses.delete_one({"easy_address_id": easy_address_id})
    return {"message": "Kolay adres silindi."}


@app.get("/accounts/{account_id}/balance")
async def account_balance(account_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await get_account_or_404(db, account_id)
    ensure_account_access(current_user, account, allow_staff=True)
    balance = await get_balance(db, account_id)
    return {"account_id": account_id, "balance": balance, "currency": account["currency"]}


@app.patch("/accounts/{account_id}/toggle-freeze")
async def toggle_freeze(account_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    account = await get_account_or_404(db, account_id)
    ensure_account_access(current_user, account, allow_staff=False)
    new_status = "frozen" if account["status"] == "active" else "active"
    await db.accounts.update_one({"account_id": account_id}, {"$set": {"status": new_status}})
    return {"message": "Hesap durumu guncellendi.", "status": new_status}

@app.post("/transactions/deposit")
async def deposit(body: DepositRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, account, allow_staff=True)
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Hesap aktif degil.")

    txn_ref = f"DEP-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(
        db,
        body.account_id,
        "CREDIT",
        "DEPOSIT",
        body.amount,
        txn_ref,
        current_user["user_id"],
        body.description or "Para yatirma",
    )
    return {"message": "Para yatirildi.", "transaction_ref": txn_ref, "amount": body.amount}


@app.post("/transactions/withdraw")
async def withdraw(body: WithdrawRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, account, allow_staff=True)
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Hesap aktif degil.")

    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    txn_ref = f"WDR-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(
        db,
        body.account_id,
        "DEBIT",
        "WITHDRAWAL",
        body.amount,
        txn_ref,
        current_user["user_id"],
        body.description or "Para cekme",
    )
    return {"message": "Para cekildi.", "transaction_ref": txn_ref, "amount": body.amount}


async def _notify_transfer_ws(
    db,
    sender_user_id: str,
    receiver_user_id: str,
    amount: float,
    currency: str,
    txn_ref: str,
    description: str,
    sender_iban: str,
    receiver_iban: str,
):
    """Notification service'e HTTP POST ile transfer bildirimi gönder."""
    try:
        # Gönderici ve alıcının müşteri adlarını bul
        sender_customer = await db.customers.find_one({"user_id": sender_user_id})
        receiver_customer = await db.customers.find_one({"user_id": receiver_user_id})
        sender_name = sender_customer.get("full_name", "FinBank Kullanıcısı") if sender_customer else "FinBank Kullanıcısı"
        receiver_name = receiver_customer.get("full_name", "FinBank Kullanıcısı") if receiver_customer else "FinBank Kullanıcısı"

        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{NOTIFICATION_SERVICE_URL}/internal/notify/transfer",
                json={
                    "sender_user_id": sender_user_id,
                    "receiver_user_id": receiver_user_id,
                    "sender_name": sender_name,
                    "receiver_name": receiver_name,
                    "amount": amount,
                    "currency": currency,
                    "transfer_ref": txn_ref,
                    "description": description,
                    "sender_iban": sender_iban,
                    "receiver_iban": receiver_iban,
                },
            )
    except Exception as e:
        # Bildirim gönderimi başarısız olsa bile transfer işlemi etkilenmemeli
        print(f"[WS Notify] Transfer bildirimi gönderilemedi: {e}", file=sys.stderr)


@app.post("/transactions/transfer")
async def transfer(
    body: TransferRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    ensure_positive_amount(body.amount)
    from_account = await get_account_or_404(db, body.from_account_id)
    ensure_account_access(current_user, from_account, allow_staff=True)
    target_account = await resolve_target_account(db, body)

    if from_account["account_id"] == target_account["account_id"]:
        raise HTTPException(status_code=400, detail="Ayni hesaba transfer yapilamaz.")
    if from_account["status"] != "active" or target_account["status"] != "active":
        raise HTTPException(status_code=400, detail="Hesaplardan biri aktif degil.")

    balance = await get_balance(db, from_account["account_id"])
    if balance < body.amount:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    # INTER-BANK WEBSOCKET GÖNDERİMİ (ISO 20022 Pacs.008)
    if target_account.get("is_external"):
        external_bank_code = target_account.get("bank_code")
        ws_url = EXTERNAL_BANKS.get(external_bank_code)
        if not ws_url:
            raise HTTPException(status_code=400, detail=f"{external_bank_code} bankasina baglanti destegi yok.")
        
        # Get Sender Name
        sender_customer = await db.customers.find_one({"user_id": current_user["user_id"]})
        sender_name = sender_customer.get("full_name", "FinBank Kullanicisi") if sender_customer else "FinBank Kullanicisi"
        
        # XML Oluştur
        pacs008_xml = generate_pacs008_xml(
            amount=body.amount,
            currency=from_account.get("currency", "TRY"),
            sender_name=sender_name,
            sender_iban=from_account.get("iban", ""),
            receiver_name="Unknown External User",
            receiver_iban=target_account.get("iban", ""),
            receiver_bank_bic=external_bank_code,
            description=body.description or "Inter-Bank Transfer"
        )
        
        # WS Bağlantısı kur ve Onay bekle
        try:
            async with websockets.connect(ws_url) as websocket:
                await websocket.send(pacs008_xml)
                
                # Karşı taraftan pacs.002 ACK bekle (5 saniye timeout)
                response_xml = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                
                pacs002_result = parse_pacs002_xml(response_xml)
                if not pacs002_result.get("success"):
                    reason = pacs002_result.get("reason", "Unknown external rejection")
                    raise HTTPException(status_code=400, detail=f"Karsi banka transferi reddetti: {reason}")
                    
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Karsi bankadan zamaninda yanit alinamadi.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=502, detail=f"Karsi bankaya baglanti hatasi: {str(e)}")


    txn_ref = f"TRF-{uuid.uuid4().hex[:8].upper()}"
    description = body.description or "Transfer"
    debit_metadata = {
        "counterparty_account_id": target_account["account_id"],
        "counterparty_iban": target_account["iban"],
        "counterparty_user_id": target_account["user_id"],
        "is_external": target_account.get("is_external", False)
    }
    await create_ledger_entry(
        db,
        from_account["account_id"],
        "DEBIT",
        "TRANSFER_OUT",
        body.amount,
        txn_ref,
        current_user["user_id"],
        description,
        debit_metadata,
    )
    
    # Sadece banka içi (internal) transferlerde alıcının bakiyesi artırılır
    if not target_account.get("is_external"):
        credit_metadata = {
            "counterparty_account_id": from_account["account_id"],
            "counterparty_iban": from_account["iban"],
            "counterparty_user_id": from_account["user_id"],
        }
        await create_ledger_entry(
            db,
            target_account["account_id"],
            "CREDIT",
            "TRANSFER_IN",
            body.amount,
            txn_ref,
            current_user["user_id"],
            description,
            credit_metadata,
        )

    # 🔔 WebSocket bildirimi: arka planda gönder (transfer'i bloke etmez)
    background_tasks.add_task(
        _notify_transfer_ws,
        db,
        current_user["user_id"],
        target_account["user_id"],
        body.amount,
        from_account.get("currency", "TRY"),
        txn_ref,
        description,
        from_account.get("iban", ""),
        target_account.get("iban", ""),
    )

    return {
        "message": "Transfer basarili.",
        "transaction_ref": txn_ref,
        "amount": body.amount,
        "from_account_id": from_account["account_id"],
        "to_account_id": target_account["account_id"],
        "to_iban": target_account["iban"],
    }


@app.get("/transactions/history")
async def transaction_history(
    page: int = 1,
    limit: int = 20,
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}, {"account_id": 1}).to_list(100)
    account_ids = [account["account_id"] for account in accounts]
    query = {"account_id": {"$in": account_ids}}
    if type:
        query["type"] = type
    if category:
        query["category"] = category.upper()
    if search:
        query["description"] = {"$regex": search, "$options": "i"}

    skip = max(page - 1, 0) * limit
    entries = await db.ledger_entries.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ledger_entries.count_documents(query)
    return {"data": [serialize_ledger_entry(entry) for entry in entries], "total": total, "page": page, "limit": limit}

@app.post("/payment-requests")
async def create_payment_request(body: PaymentRequestCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    
    # Resolve target user from alias
    target_user_id = None
    target_name = "Bilinmeyen Kullanici"
    
    # 1. Check customers by phone or email or national_id
    customer = await db.customers.find_one({
        "$or": [
            {"phone": body.target_alias.strip()},
            {"email": body.target_alias.strip()},
            {"national_id": body.target_alias.strip()}
        ]
    })
    
    if customer:
        target_user_id = customer["user_id"]
        target_name = customer.get("full_name") or target_name
    else:
        # 2. Check easy addresses
        candidates = candidate_easy_address_values(body.target_alias.strip())
        if candidates:
            easy_address = await db.easy_addresses.find_one({"alias_value_normalized": {"$in": candidates}, "status": "active"})
            if easy_address:
                target_user_id = easy_address["user_id"]
                target_customer = await db.customers.find_one({"user_id": target_user_id})
                if target_customer:
                    target_name = target_customer.get("full_name") or target_name

    if not target_user_id:
        raise HTTPException(status_code=404, detail="Alici profili bulunamadi. Lutfen gecerli bir telefon, e-posta, TC veya kolay adres girin.")

    if target_user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Kendinize odeme istegi gonderemezsiniz.")

    requester_customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    requester_name = requester_customer.get("full_name") if requester_customer else "FinBank Musterisi"

    document = {
        "request_id": str(uuid.uuid4()),
        "requester_user_id": current_user["user_id"],
        "requester_name": requester_name,
        "target_user_id": target_user_id,
        "target_name": target_name,
        "amount": body.amount,
        "description": body.description or "Odeme Istegi",
        "status": "pending",
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    await db.payment_requests.insert_one(document)
    
    # Filter out _id for response
    document.pop("_id", None)
    return {"message": "Odeme istegi gonderildi.", "data": document}


@app.get("/payment-requests")
async def list_payment_requests(current_user=Depends(get_current_user), db=Depends(get_database)):
    user_id = current_user["user_id"]
    requests = await db.payment_requests.find({
        "$or": [
            {"requester_user_id": user_id},
            {"target_user_id": user_id}
        ]
    }).sort("created_at", -1).to_list(100)
    
    for req in requests:
        req.pop("_id", None)
        
    return {"data": requests}


@app.post("/payment-requests/{request_id}/approve")
async def approve_payment_request(request_id: str, body: PaymentRequestAction, current_user=Depends(get_current_user), db=Depends(get_database)):
    req = await db.payment_requests.find_one({"request_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Odeme istegi bulunamadi.")
    if req["target_user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Bu istegi onaylama yetkiniz yok.")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Bu istek zaten '{req['status']}' durumunda.")

    # Validate paying account
    paying_account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, paying_account, allow_staff=False)
    
    if paying_account["status"] != "active":
        raise HTTPException(status_code=400, detail="Odeme yapilacak hesap aktif degil.")

    balance = await get_balance(db, paying_account["account_id"])
    if balance < req["amount"]:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    # Find recipient account (default to their first checking account)
    recipient_accounts = await db.accounts.find({"user_id": req["requester_user_id"], "status": "active"}).sort("created_at", 1).to_list(1)
    if not recipient_accounts:
        raise HTTPException(status_code=400, detail="Istegi yapan kisinin aktif bir hesabi bulunamadi.")
    
    recipient_account = recipient_accounts[0]

    # Process transfer
    txn_ref = f"PRQ-{uuid.uuid4().hex[:8].upper()}"
    description = f"Odeme Istegi: {req['description']}"
    
    await create_ledger_entry(
        db, paying_account["account_id"], "DEBIT", "TRANSFER_OUT", req["amount"], txn_ref, current_user["user_id"], description,
        {"counterparty_account_id": recipient_account["account_id"], "counterparty_user_id": recipient_account["user_id"]}
    )
    await create_ledger_entry(
        db, recipient_account["account_id"], "CREDIT", "TRANSFER_IN", req["amount"], txn_ref, req["requester_user_id"], description,
        {"counterparty_account_id": paying_account["account_id"], "counterparty_user_id": paying_account["user_id"]}
    )

    # Update request status
    await db.payment_requests.update_one({"request_id": request_id}, {"$set": {"status": "paid", "updated_at": now_utc()}})
    
    return {"message": "Odeme basariyla gerceklestirildi.", "transaction_ref": txn_ref}


@app.post("/payment-requests/{request_id}/reject")
async def reject_payment_request(request_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    req = await db.payment_requests.find_one({"request_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Odeme istegi bulunamadi.")
    if req["target_user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Bu istegi reddetme yetkiniz yok.")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Bu istek zaten '{req['status']}' durumunda.")

    await db.payment_requests.update_one({"request_id": request_id}, {"$set": {"status": "rejected", "updated_at": now_utc()}})
    return {"message": "Odeme istegi reddedildi."}


@app.post("/payment-requests/{request_id}/cancel")
async def cancel_payment_request(request_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    req = await db.payment_requests.find_one({"request_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Odeme istegi bulunamadi.")
    if req["requester_user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Bu istegi iptal etme yetkiniz yok.")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Bu istek zaten '{req['status']}' durumunda.")

    await db.payment_requests.update_one({"request_id": request_id}, {"$set": {"status": "cancelled", "updated_at": now_utc()}})
    return {"message": "Odeme istegi iptal edildi."}


@app.get("/ledger/{account_id}")
async def get_account_ledger(
    account_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    account = await get_account_or_404(db, account_id)
    ensure_account_access(current_user, account, allow_staff=True)
    query = {"account_id": account_id}
    entries = await db.ledger_entries.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ledger_entries.count_documents(query)
    serialized = [serialize_ledger_entry(entry) for entry in entries]
    return {"entries": serialized, "total": total}


@app.get("/ledger")
async def get_all_ledger(
    skip: int = 0,
    limit: int = 20,
    type: Optional[str] = None,
    category: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    accounts = await db.accounts.find({"user_id": current_user["user_id"]}, {"account_id": 1}).to_list(100)
    account_ids = [account["account_id"] for account in accounts]
    query = {"account_id": {"$in": account_ids}}
    if type:
        query["type"] = type
    if category:
        query["category"] = category.upper()

    entries = await db.ledger_entries.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ledger_entries.count_documents(query)
    serialized = [serialize_ledger_entry(entry) for entry in entries]
    return {"entries": serialized, "total": total}


@app.get("/bills")
async def list_bills(current_user=Depends(get_current_user), db=Depends(get_database)):
    bills = await db.bills.find({"user_id": current_user["user_id"]}).sort("paid_at", -1).to_list(50)
    return [serialize_bill(bill) for bill in bills]


@app.post("/bills/pay")
async def pay_bill(body: BillPayRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, account, allow_staff=True)
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Hesap aktif degil.")

    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    txn_ref = f"BILL-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(
        db,
        body.account_id,
        "DEBIT",
        "BILL_PAYMENT",
        body.amount,
        txn_ref,
        current_user["user_id"],
        f"Fatura: {body.provider}",
    )
    bill_doc = {
        "bill_id": str(uuid.uuid4()),
        "user_id": account["user_id"],
        "account_id": body.account_id,
        "bill_type": body.bill_type,
        "provider": body.provider,
        "subscriber_no": body.subscriber_no,
        "amount": body.amount,
        "status": "paid",
        "paid_at": now_utc(),
    }
    await db.bills.insert_one(bill_doc)
    return {"message": "Fatura odendi.", "bill_id": bill_doc["bill_id"]}


@app.get("/bills/history")
async def bill_history(current_user=Depends(get_current_user), db=Depends(get_database)):
    bills = await db.bills.find({"user_id": current_user["user_id"]}).sort("paid_at", -1).to_list(50)
    return [serialize_bill(bill) for bill in bills]


@app.post("/goals")
async def create_goal(body: GoalCreateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.target_amount)
    document = {
        "goal_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "name": body.name.strip(),
        "target_amount": body.target_amount,
        "current_amount": 0.0,
        "deadline": body.deadline,
        "status": "active",
        "created_at": now_utc(),
    }
    await db.savings_goals.insert_one(document)
    return {"message": "Tasarruf hedefi olusturuldu.", "goal_id": document["goal_id"]}


@app.get("/goals")
async def list_goals(current_user=Depends(get_current_user), db=Depends(get_database)):
    goals = await db.savings_goals.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(20)
    return [serialize_goal(goal) for goal in goals]


@app.post("/goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, body: GoalContributeRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    goal = await db.savings_goals.find_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Hedef bulunamadi.")

    account = await get_account_or_404(db, body.account_id)
    ensure_account_access(current_user, account, allow_staff=False)
    balance = await get_balance(db, body.account_id)
    if balance < body.amount:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    txn_ref = f"GOAL-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(
        db,
        body.account_id,
        "DEBIT",
        "GOAL_CONTRIBUTION",
        body.amount,
        txn_ref,
        current_user["user_id"],
        f"Tasarruf: {goal['name']}",
    )
    new_amount = float(goal.get("current_amount", 0)) + body.amount
    status = "completed" if new_amount >= float(goal["target_amount"]) else "active"
    await db.savings_goals.update_one({"goal_id": goal_id}, {"$set": {"current_amount": new_amount, "status": status}})
    return {"message": "Hedefe para eklendi.", "current_amount": new_amount, "status": status}


@app.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.savings_goals.delete_one({"goal_id": goal_id, "user_id": current_user["user_id"]})
    return {"message": "Hedef silindi."}

@app.get("/cards")
async def list_cards(current_user=Depends(get_current_user), db=Depends(get_database)):
    cards = await db.credit_cards.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(20)
    cards.sort(key=lambda card: 1 if card.get("is_virtual") else 0)
    return [serialize_card(card) for card in cards]


@app.post("/cards/apply")
async def apply_for_card(body: Optional[CardApplicationRequest] = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    existing = await db.credit_cards.find_one({"user_id": current_user["user_id"], "is_virtual": False})
    if existing:
        raise HTTPException(status_code=409, detail="Bu kullanici icin zaten fiziksel kredi karti var.")

    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer or customer.get("status") != "active":
        raise HTTPException(status_code=403, detail="Kredi karti icin aktif KYC gerekli.")

    requested_limit = body.requested_limit if body and body.requested_limit else 25000.0
    card_limit = min(max(requested_limit, 10000.0), 150000.0)
    card = build_card_document(
        user_id=current_user["user_id"],
        customer=customer,
        card_number=await generate_card_number(db),
        card_limit=card_limit,
        card_name="FinBank Credit",
        is_virtual=False,
        online_limit=card_limit,
    )
    await db.credit_cards.insert_one(card)
    return serialize_card(card)


@app.post("/cards/virtual")
async def create_virtual_card(body: Optional[VirtualCardCreateRequest] = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    physical_card = await db.credit_cards.find_one({"user_id": current_user["user_id"], "is_virtual": False, "status": "active"})
    if not physical_card:
        raise HTTPException(status_code=400, detail="Sanal kart icin once aktif fiziksel kart gerekli.")

    customer = await db.customers.find_one({"user_id": current_user["user_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Musteri profili bulunamadi.")

    virtual_count = await db.credit_cards.count_documents({"user_id": current_user["user_id"], "is_virtual": True})
    if virtual_count >= 5:
        raise HTTPException(status_code=400, detail="En fazla 5 sanal kart olusturabilirsiniz.")

    requested_online_limit = body.online_limit if body and body.online_limit else min(float(physical_card["available_limit"]), 5000.0)
    if requested_online_limit <= 0 or requested_online_limit > float(physical_card["available_limit"]):
        raise HTTPException(status_code=400, detail="Sanal kart limiti fiziksel kart limitini asamaz.")

    card_name = (body.alias.strip() if body and body.alias else "Sanal Kart {0}".format(virtual_count + 1))[:32]
    card = build_card_document(
        user_id=current_user["user_id"],
        customer=customer,
        card_number=await generate_card_number(db),
        card_limit=requested_online_limit,
        card_name=card_name,
        is_virtual=True,
        online_limit=requested_online_limit,
        parent_card_id=physical_card["card_id"],
    )
    await db.credit_cards.insert_one(card)
    return serialize_card(card)


@app.patch("/cards/{card_id}/settings")
async def update_card_settings(card_id: str, body: CardSettingsUpdateRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)

    updates = {}
    if body.internet_enabled is not None:
        updates["internet_enabled"] = body.internet_enabled
    if body.contactless_enabled is not None:
        updates["contactless_enabled"] = body.contactless_enabled
    if body.overseas_enabled is not None:
        updates["overseas_enabled"] = body.overseas_enabled
    if body.online_limit is not None:
        if body.online_limit > float(card["limit"]):
            raise HTTPException(status_code=400, detail="Online limit kart limitini asamaz.")
        updates["online_limit"] = round(float(body.online_limit), 2)

    if not updates:
        raise HTTPException(status_code=400, detail="Guncellenecek kart ayari gonderilmedi.")

    await db.credit_cards.update_one({"card_id": card_id}, {"$set": updates})
    updated = await db.credit_cards.find_one({"card_id": card_id})
    return serialize_card(updated)


@app.patch("/cards/{card_id}/toggle-freeze")
async def toggle_card_freeze(card_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)
    new_status = "frozen" if card.get("status") == "active" else "active"
    await db.credit_cards.update_one({"card_id": card_id}, {"$set": {"status": new_status}})
    updated = await db.credit_cards.find_one({"card_id": card_id})
    return {"message": "Kart durumu guncellendi.", "card": serialize_card(updated)}


@app.delete("/cards/{card_id}")
async def delete_virtual_card(card_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)
    if not card.get("is_virtual"):
        raise HTTPException(status_code=400, detail="Fiziksel kart silinemez.")
    if float(card.get("current_debt", 0)) > 0:
        raise HTTPException(status_code=400, detail="Borcu olan sanal kart silinemez.")
    await db.card_transactions.delete_many({"card_id": card_id})
    await db.credit_cards.delete_one({"card_id": card_id})
    return {"message": "Sanal kart silindi."}


@app.get("/cards/{card_id}/transactions")
async def get_card_transactions(card_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)
    transactions = await db.card_transactions.find({"card_id": card_id}).sort("created_at", -1).to_list(50)
    return [serialize_card_transaction(tx) for tx in transactions]


@app.post("/cards/{card_id}/purchase")
async def card_purchase(
    card_id: str,
    amount: float,
    description: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    ensure_positive_amount(amount)
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)
    if card["status"] != "active":
        raise HTTPException(status_code=400, detail="Kart aktif degil.")
    if not card.get("internet_enabled", True):
        raise HTTPException(status_code=400, detail="Kart internet alisverisine kapali.")
    if float(card.get("online_limit") or card["available_limit"]) < amount:
        raise HTTPException(status_code=400, detail="Online harcama limiti asildi.")
    if float(card["available_limit"]) < amount:
        raise HTTPException(status_code=400, detail="Yetersiz kart limiti.")

    new_debt = float(card["current_debt"]) + amount
    new_available_limit = float(card["limit"]) - new_debt
    min_payment_due = round(new_debt * CARD_MIN_PAYMENT_RATIO, 2)
    await db.credit_cards.update_one(
        {"card_id": card_id},
        {"$set": {"current_debt": new_debt, "available_limit": new_available_limit, "min_payment_due": min_payment_due}},
    )
    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "card_id": card_id,
        "user_id": card["user_id"],
        "type": "purchase",
        "amount": amount,
        "description": description or "Kart harcamasi",
        "created_at": now_utc(),
    }
    await db.card_transactions.insert_one(transaction)
    updated = await db.credit_cards.find_one({"card_id": card_id})
    return {"message": "Kart harcamasi kaydedildi.", "card": serialize_card(updated), "transaction": serialize_card_transaction(transaction)}


@app.post("/cards/{card_id}/pay")
async def pay_card_debt(card_id: str, body: CardPaymentRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    ensure_positive_amount(body.amount)
    card = await get_card_or_404(db, card_id)
    ensure_card_access(current_user, card)
    account = await get_account_or_404(db, body.from_account_id)
    ensure_account_access(current_user, account, allow_staff=False)
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Odeme hesabi aktif degil.")
    if float(card["current_debt"]) <= 0:
        raise HTTPException(status_code=400, detail="Odenecek kart borcu yok.")

    payment_amount = min(body.amount, float(card["current_debt"]))
    balance = await get_balance(db, body.from_account_id)
    if balance < payment_amount:
        raise HTTPException(status_code=400, detail="Yetersiz bakiye.")

    txn_ref = f"CCP-{uuid.uuid4().hex[:8].upper()}"
    await create_ledger_entry(
        db,
        body.from_account_id,
        "DEBIT",
        "CARD_PAYMENT",
        payment_amount,
        txn_ref,
        current_user["user_id"],
        "Kredi karti odemesi",
        {"card_id": card_id},
    )

    new_debt = round(float(card["current_debt"]) - payment_amount, 2)
    new_available_limit = round(float(card["limit"]) - new_debt, 2)
    min_payment_due = round(new_debt * CARD_MIN_PAYMENT_RATIO, 2)
    await db.credit_cards.update_one(
        {"card_id": card_id},
        {"$set": {"current_debt": new_debt, "available_limit": new_available_limit, "min_payment_due": min_payment_due}},
    )
    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "card_id": card_id,
        "user_id": card["user_id"],
        "type": "payment",
        "amount": payment_amount,
        "description": "Kart borcu odemesi",
        "created_at": now_utc(),
    }
    await db.card_transactions.insert_one(transaction)
    updated = await db.credit_cards.find_one({"card_id": card_id})
    return {"message": "Kart borcu odendi.", "card": serialize_card(updated), "transaction": serialize_card_transaction(transaction)}


@app.get("/exchange-rates")
async def get_exchange_rates():
    return {"rates": MOCK_RATES, "base": "TRY", "updated_at": now_utc().isoformat()}


@app.get("/exchange/rates")
async def get_exchange_rates_alias():
    return await get_exchange_rates()


@app.websocket("/ws/inter-bank/{sender_bank_code}")
async def inter_bank_websocket(websocket: WebSocket, sender_bank_code: str, db=Depends(get_database)):
    """
    Karsi bankalardan gelen ISO 20022 Pacs.008 para transferlerini kabul eden WebSocket.
    """
    await websocket.accept()
    
    try:
        # Karşı bankadan XML mesajını bekle
        xml_data = await websocket.receive_text()
        
        # pacs.008 ayrıştırma
        transfer_details = parse_pacs008_xml(xml_data)
        
        receiver_iban = transfer_details.get("receiver_iban")
        amount = transfer_details.get("amount")
        currency = transfer_details.get("currency")
        msg_id = transfer_details.get("msg_id")
        
        if not receiver_iban or not amount:
            # Eksik bilgi -> REJECT
            reject_xml = generate_pacs002_xml(msg_id, "RJCT", "Missing receiver_iban or amount in pacs.008")
            await websocket.send_text(reject_xml)
            await websocket.close()
            return

        # Bizim veritabanımızda alıcı IBAN'ı bul
        target_account = await db.accounts.find_one({"iban": receiver_iban, "status": "active"})
        
        if not target_account:
            # Hesap bulunamadı -> REJECT
            reject_xml = generate_pacs002_xml(msg_id, "RJCT", "Account not found or inactive")
            await websocket.send_text(reject_xml)
            await websocket.close()
            return

        # Para ekleme işlemleri (Ledger)
        txn_ref = f"TRF-EXT-{uuid.uuid4().hex[:8].upper()}"
        description = transfer_details.get("description", "Dıș Banka Transferi")
        
        # Sadece bizim tarafımıza Credit yazarız (Giden banka kendi Debit'ini yazdı)
        credit_metadata = {
            "counterparty_iban": transfer_details.get("sender_iban"),
            "counterparty_name": transfer_details.get("sender_name"),
            "sender_bank_code": sender_bank_code,
            "msg_id": msg_id,
        }
        
        await create_ledger_entry(
            db,
            target_account["account_id"],
            "CREDIT",
            "TRANSFER_IN",
            amount,
            txn_ref,
            target_account["user_id"], # Parayı alan kişi (system değil)
            description,
            credit_metadata,
        )

        # Başarı onayı yolla (pacs.002 ACCEPT)
        accept_xml = generate_pacs002_xml(msg_id, "ACCP")
        await websocket.send_text(accept_xml)
        
        # Bildirim fırlat (internal notification service websocket'i tetiklemesi için)
        try:
            # Kullanıcı adını al
            target_customer = await db.customers.find_one({"user_id": target_account["user_id"]})
            receiver_name = target_customer.get("full_name", "FinBank Kullanicisi") if target_customer else "FinBank Kullanicisi"
            sender_name = transfer_details.get("sender_name", "Bilinmeyen Gönderici")
            
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{NOTIFICATION_SERVICE_URL}/internal/notify/transfer",
                    json={
                        "sender_user_id": "EXTERNAL", # Karsi bankadan oldugu icin
                        "receiver_user_id": target_account["user_id"],
                        "sender_name": sender_name,
                        "receiver_name": receiver_name,
                        "amount": amount,
                        "currency": currency,
                        "transfer_ref": txn_ref,
                        "description": description,
                        "sender_iban": transfer_details.get("sender_iban", ""),
                        "receiver_iban": receiver_iban,
                    },
                )
        except Exception as e:
            print(f"[Inter-Bank WS] Bildirim tetiklenirken hata: {e}", file=sys.stderr)
            
    except WebSocketDisconnect:
        print(f"[Inter-Bank WS] {sender_bank_code} client disconnected.")
    except Exception as e:
        print(f"[Inter-Bank WS] Hata: {e}", file=sys.stderr)
        try:
            # Bir şeyler patlarsa teknik hata (RJCT) dön
            error_xml = generate_pacs002_xml("UNKNOWN", "RJCT", f"Internal Error: {str(e)}")
            await websocket.send_text(error_xml)
        except:
            pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass # Zaten kapalıysa yoksay
