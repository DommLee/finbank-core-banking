"""
FinBank Auth Service - Supabase-backed authentication with local JWT sessions.
Port: 8001
"""
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional

import os
import re
import secrets
import sys
import uuid

import pyotp
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from supabase import Client, create_client

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import settings
from shared.database import close_mongo_connection, connect_to_mongo, get_database
from shared.jwt_utils import create_access_token, get_current_user


ROLE_REDIRECTS = {
    "customer": "/customer/dashboard",
    "employee": "/employee/portal",
    "ceo": "/executive/cockpit",
    "admin": "/admin/dashboard",
}
PUBLIC_ROLE = "customer"

_supabase_client: Optional[Client] = None
_supabase_lock = Lock()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = PUBLIC_ROLE


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    validate_auth_runtime_settings()

    db = await connect_to_mongo()
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("user_id", unique=True)
    await db.customers.create_index("national_id", unique=True, sparse=True)
    await db.verification_codes.create_index("email")
    await db.verification_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("user_id")
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.login_history.create_index("user_id")
    await db.login_history.create_index("email")
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Auth Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_auth_runtime_settings() -> None:
    missing = []
    if not settings.SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise RuntimeError("Missing auth configuration: " + ", ".join(missing))


def get_supabase_client() -> Client:
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    validate_auth_runtime_settings()
    with _supabase_lock:
        if _supabase_client is None:
            _supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )
    return _supabase_client


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_redirect_url(role: str) -> str:
    return ROLE_REDIRECTS.get(role, "/")


def get_request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in full_name.strip().split() if part]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Sifre en az 8 karakter olmali.")

    checks = [
        bool(re.search(r"[A-Z]", password)),
        bool(re.search(r"[a-z]", password)),
        bool(re.search(r"\d", password)),
        bool(re.search(r"[^A-Za-z0-9]", password)),
    ]
    if sum(checks) < 3:
        raise HTTPException(
            status_code=400,
            detail="Sifre en az 3 farkli karakter tipi icermeli.",
        )


def validate_turkish_identity_number(national_id: Optional[str]) -> Optional[str]:
    if not national_id:
        return None

    tc = national_id.strip()
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


def build_public_user(user_doc: dict) -> dict:
    created_at = user_doc.get("created_at")
    return {
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "full_name": user_doc.get("full_name", ""),
        "role": user_doc.get("role", PUBLIC_ROLE),
        "is_active": user_doc.get("is_active", True),
        "kyc_status": user_doc.get("kyc_status", "PENDING"),
        "two_factor_enabled": user_doc.get("two_factor_enabled", False),
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
    }


async def get_user_record(db, user_id: str) -> dict:
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanici profili bulunamadi.")
    return user


async def record_login_history(
    db,
    request: Request,
    email: str,
    success: bool,
    user: Optional[dict] = None,
) -> None:
    doc = {
        "email": email,
        "success": success,
        "ip": get_request_ip(request),
        "user_agent": request.headers.get("user-agent", "unknown"),
        "timestamp": now_utc(),
    }
    if user:
        doc["user_id"] = user["user_id"]
    await db.login_history.insert_one(doc)


async def create_local_session(db, request: Request, user: dict) -> str:
    session_id = str(uuid.uuid4())
    await db.sessions.insert_one(
        {
            "session_id": session_id,
            "user_id": user["user_id"],
            "ip": get_request_ip(request),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(hours=24),
        }
    )
    return session_id


def build_customer_profile(user_id: str, email: str, body: RegisterRequest, created_at: datetime) -> dict:
    first_name, last_name = split_full_name(body.full_name)
    return {
        "customer_id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": email,
        "full_name": body.full_name.strip(),
        "first_name": first_name,
        "last_name": last_name,
        "national_id": validate_turkish_identity_number(body.national_id),
        "phone": body.phone.strip() if body.phone else None,
        "date_of_birth": body.date_of_birth,
        "address": body.address.strip() if body.address else None,
        "status": "pending_kyc",
        "kyc_verified": False,
        "created_at": created_at,
        "updated_at": created_at,
    }


async def create_local_profiles(db, user_id: str, email: str, body: RegisterRequest, created_at: datetime) -> tuple[dict, dict]:
    user_doc = {
        "user_id": user_id,
        "email": email,
        "full_name": body.full_name.strip(),
        "role": PUBLIC_ROLE,
        "is_active": True,
        "is_verified": True,
        "email_verified": True,
        "kyc_status": "PENDING",
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "created_at": created_at,
    }
    customer_doc = build_customer_profile(user_id, email, body, created_at)

    await db.users.insert_one(user_doc)
    await db.customers.insert_one(customer_doc)
    return user_doc, customer_doc


async def delete_supabase_user_if_needed(user_id: str) -> None:
    try:
        get_supabase_client().auth.admin.delete_user(user_id)
    except Exception:
        pass


def require_dev_seed_access(request: Request) -> None:
    if not settings.DEBUG or not settings.ENABLE_DEV_SEED_ROUTES:
        raise HTTPException(status_code=404, detail="Not found")

    expected_token = settings.DEV_BOOTSTRAP_TOKEN
    provided_token = request.headers.get("X-Bootstrap-Token", "")
    if not expected_token or not secrets.compare_digest(provided_token, expected_token):
        raise HTTPException(status_code=403, detail="Bootstrap access denied")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "auth-service"}


@app.post("/register", status_code=201)
async def register(body: RegisterRequest, request: Request, db=Depends(get_database)):
    email = normalize_email(str(body.email))
    full_name = body.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Ad soyad en az 2 karakter olmali.")

    validate_password_strength(body.password)
    national_id = validate_turkish_identity_number(body.national_id)

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayitli.")

    if national_id:
        existing_tc = await db.customers.find_one({"national_id": national_id})
        if existing_tc:
            raise HTTPException(status_code=409, detail="Bu TC Kimlik ile zaten hesap var.")

    created_at = now_utc()
    try:
        supabase_user = get_supabase_client().auth.admin.create_user(
            {
                "email": email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "role": PUBLIC_ROLE,
                },
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Supabase auth hatasi: {exc}")

    if not supabase_user or not getattr(supabase_user, "user", None):
        raise HTTPException(status_code=500, detail="Supabase kullanicisi olusturulamadi.")

    user_id = supabase_user.user.id
    try:
        user_doc, customer_doc = await create_local_profiles(db, user_id, email, body, created_at)
    except Exception as exc:
        await delete_supabase_user_if_needed(user_id)
        raise HTTPException(status_code=500, detail="Lokal profil olusturulamadi.") from exc

    await db.login_history.insert_one(
        {
            "user_id": user_id,
            "email": email,
            "success": True,
            "action": "register",
            "ip": get_request_ip(request),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "timestamp": created_at,
        }
    )

    return {
        "message": "Kayit basarili.",
        "email": user_doc["email"],
        "role": user_doc["role"],
        "user_id": user_doc["user_id"],
        "customer_id": customer_doc["customer_id"],
        "requires_verification": False,
    }


@app.post("/login")
async def login(body: LoginRequest, request: Request, db=Depends(get_database)):
    email = normalize_email(str(body.email))

    try:
        auth_response = get_supabase_client().auth.sign_in_with_password(
            {"email": email, "password": body.password}
        )
    except Exception:
        await record_login_history(db, request, email, False)
        raise HTTPException(status_code=401, detail="E-posta veya sifre hatali.")

    session = getattr(auth_response, "session", None)
    if session is None:
        await record_login_history(db, request, email, False)
        raise HTTPException(status_code=401, detail="Giris oturumu olusturulamadi.")

    user = await db.users.find_one({"email": email})
    if not user:
        await record_login_history(db, request, email, False)
        raise HTTPException(status_code=404, detail="Lokal kullanici profili eksik.")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Kullanici hesabi devre disi.")

    if user.get("two_factor_enabled"):
        if not body.totp_code:
            return {"requires_2fa": True, "message": "2FA kodu gerekli."}
        secret = user.get("two_factor_secret")
        if not secret or not pyotp.TOTP(secret).verify(body.totp_code):
            raise HTTPException(status_code=401, detail="2FA kodu hatali.")

    token = create_access_token(
        {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"],
        }
    )
    session_id = await create_local_session(db, request, user)
    await record_login_history(db, request, email, True, user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user["email"],
        "role": user["role"],
        "redirect_url": get_redirect_url(user["role"]),
        "session_id": session_id,
        "user": build_public_user(user),
        "supabase_access_token": getattr(session, "access_token", None),
        "supabase_refresh_token": getattr(session, "refresh_token", None),
    }


@app.get("/me")
async def me(current_user=Depends(get_current_user), db=Depends(get_database)):
    user = await get_user_record(db, current_user["user_id"])
    response = build_public_user(user)
    response["redirect_url"] = get_redirect_url(user["role"])

    customer = await db.customers.find_one({"user_id": user["user_id"]})
    if customer:
        response["full_name"] = customer.get("full_name") or response["full_name"]
        response["customer"] = {
            "customer_id": customer.get("customer_id"),
            "status": customer.get("status"),
            "phone": customer.get("phone"),
        }
    return response


@app.post("/verify-email")
async def verify_email(body: VerifyEmailRequest, db=Depends(get_database)):
    email = normalize_email(str(body.email))
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi.")

    await db.users.update_one(
        {"email": email},
        {"$set": {"email_verified": True, "is_verified": True, "is_active": True}},
    )
    await db.verification_codes.update_many(
        {"email": email, "used": False},
        {"$set": {"used": True, "verified_at": now_utc()}},
    )
    return {"message": "E-posta dogrulandi.", "verified": True}


@app.post("/resend-code")
async def resend_code(body: ResendCodeRequest, db=Depends(get_database)):
    email = normalize_email(str(body.email))
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi.")

    if user.get("email_verified", True):
        return {"message": "Supabase auto-confirm aktif. Ek kod gerekmiyor.", "requires_verification": False}

    code = f"{secrets.randbelow(900000) + 100000}"
    await db.verification_codes.update_many(
        {"email": email, "used": False},
        {"$set": {"used": True}},
    )
    await db.verification_codes.insert_one(
        {
            "email": email,
            "code": code,
            "used": False,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(minutes=10),
        }
    )

    payload = {"message": "Dogrulama kodu yenilendi.", "requires_verification": True}
    if settings.DEBUG:
        payload["debug_code"] = code
    return payload


@app.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    user = await get_user_record(db, current_user["user_id"])
    validate_password_strength(body.new_password)

    try:
        get_supabase_client().auth.sign_in_with_password(
            {"email": user["email"], "password": body.current_password}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Mevcut sifre yanlis.")

    try:
        get_supabase_client().auth.admin.update_user_by_id(
            user["user_id"],
            {"password": body.new_password},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sifre guncellenemedi: {exc}")

    await db.sessions.delete_many({"user_id": user["user_id"]})
    return {"message": "Sifre guncellendi. Lutfen tekrar giris yapin."}


@app.get("/sessions")
async def list_sessions(current_user=Depends(get_current_user), db=Depends(get_database)):
    sessions = await db.sessions.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(20)
    return [
        {
            "session_id": session["session_id"],
            "ip": session.get("ip", "unknown"),
            "user_agent": session.get("user_agent", "unknown"),
            "created_at": session["created_at"].isoformat(),
        }
        for session in sessions
    ]


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.sessions.delete_one({"session_id": session_id, "user_id": current_user["user_id"]})
    return {"message": "Oturum sonlandirildi."}


@app.delete("/sessions")
async def delete_all_sessions(current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.sessions.delete_many({"user_id": current_user["user_id"]})
    return {"message": "Tum oturumlar sonlandirildi."}


@app.get("/login-history")
async def login_history(current_user=Depends(get_current_user), db=Depends(get_database)):
    docs = await db.login_history.find({"user_id": current_user["user_id"]}).sort("timestamp", -1).to_list(30)
    return [
        {
            "success": doc["success"],
            "ip": doc.get("ip", "unknown"),
            "user_agent": doc.get("user_agent", "unknown"),
            "timestamp": doc["timestamp"].isoformat(),
            "action": doc.get("action", "login"),
        }
        for doc in docs
    ]


@app.post("/2fa/setup")
async def setup_2fa(current_user=Depends(get_current_user), db=Depends(get_database)):
    user = await get_user_record(db, current_user["user_id"])
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user["email"], issuer_name="FinBank")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"two_factor_secret": secret}},
    )
    return {"secret": secret, "qr_uri": uri, "message": "2FA kurulumu hazir."}


@app.post("/2fa/verify")
async def verify_2fa(code: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    user = await get_user_record(db, current_user["user_id"])
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Once 2FA kurulumu yapin.")

    if not pyotp.TOTP(secret).verify(code):
        raise HTTPException(status_code=400, detail="Gecersiz 2FA kodu.")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"two_factor_enabled": True}},
    )
    return {"message": "2FA etkinlestirildi."}


@app.delete("/2fa/disable")
async def disable_2fa(current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"two_factor_enabled": False, "two_factor_secret": None}},
    )
    return {"message": "2FA devre disi birakildi."}


async def create_seed_account(db, email: str, full_name: str, role: str) -> dict:
    password = secrets.token_urlsafe(18)
    created_at = now_utc()
    supabase_user = get_supabase_client().auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": role},
        }
    )
    if not supabase_user or not getattr(supabase_user, "user", None):
        raise HTTPException(status_code=500, detail=f"{role} hesabi Supabase tarafinda olusturulamadi.")

    user_doc = {
        "user_id": supabase_user.user.id,
        "email": email,
        "full_name": full_name,
        "role": role,
        "is_active": True,
        "is_verified": True,
        "email_verified": True,
        "kyc_status": "APPROVED",
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "created_at": created_at,
    }
    await db.users.insert_one(user_doc)
    return {"role": role, "email": email, "password": password}


@app.get("/seed-ceo", include_in_schema=False)
async def seed_ceo(request: Request, db=Depends(get_database)):
    require_dev_seed_access(request)
    created_credentials = []

    for spec in [
        {"email": "ceo@finbank.com", "full_name": "Ahmet CEO", "role": "ceo"},
        {"email": "employee@finbank.com", "full_name": "Ayse Calisan", "role": "employee"},
    ]:
        existing_user = await db.users.find_one({"email": spec["email"]})
        if existing_user:
            continue
        created_credentials.append(
            await create_seed_account(
                db,
                email=spec["email"],
                full_name=spec["full_name"],
                role=spec["role"],
            )
        )

    if created_credentials:
        return {"message": "Development hesaplari olusturuldu.", "credentials": created_credentials}
    return {"message": "Development hesaplari zaten mevcut."}
