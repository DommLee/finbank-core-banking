"""
FinBank - Auth API Routes (Register, Login, Profile) with Supabase Integration
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
import random
import secrets
from app.core.config import settings
from app.core.database import get_database
from app.core.security import (
    supabase, get_current_user, get_redirect_url,
    create_local_access_token, hash_local_password, verify_local_password,
)
from app.models.user import (
    UserRegisterRequest, UserLoginRequest, UserRole,
    UserResponse, TokenResponse, MeResponse,
    EmailVerifyRequest, ResendCodeRequest,
)
from app.services.audit_service import log_audit, get_client_info
from app.services.supabase_sync import sync_user, sync_customer
from app.services.notification_service import send_welcome_email, send_telegram_message, send_verification_email
import uuid
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


def require_dev_seed_access(request: Request) -> None:
    """Restrict bootstrap routes to explicit local development usage."""
    if not settings.DEBUG or not settings.ENABLE_DEV_SEED_ROUTES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    expected_token = settings.DEV_BOOTSTRAP_TOKEN
    provided_token = request.headers.get("X-Bootstrap-Token", "")
    if not expected_token or not secrets.compare_digest(provided_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bootstrap access denied",
        )


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    body: UserRegisterRequest,
    request: Request,
    db=Depends(get_database),
):
    """Register a new customer account via Supabase Auth."""
    # Check if email already exists in local DB
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayÄ±tlÄ±.",
        )

    # â€” TC Kimlik NumarasÄ± DoÄŸrulama â€”
    tc = body.national_id
    if not tc or len(tc) != 11 or not tc.isdigit() or tc[0] == "0":
        raise HTTPException(status_code=400, detail="GeÃ§ersiz TC Kimlik numarasÄ±.")
    d = [int(c) for c in tc]
    odd_sum = d[0] + d[2] + d[4] + d[6] + d[8]
    even_sum = d[1] + d[3] + d[5] + d[7]
    check10 = ((odd_sum * 7) - even_sum) % 10
    if check10 != d[9]:
        raise HTTPException(status_code=400, detail="TC Kimlik numarasÄ± doÄŸrulanamadÄ±.")
    if sum(d[:10]) % 10 != d[10]:
        raise HTTPException(status_code=400, detail="TC Kimlik numarasÄ± doÄŸrulanamadÄ±.")

    # â€” TC zaten kayÄ±tlÄ± mÄ±? â€”
    existing_tc = await db.customers.find_one({"national_id": tc})
    if existing_tc:
        raise HTTPException(status_code=409, detail="Bu TC Kimlik ile zaten bir hesap mevcut.")

    # â€” Åifre GÃ¼Ã§lÃ¼lÃ¼k KontrolÃ¼ â€”
    pwd = body.password
    if len(pwd) < 8:
        raise HTTPException(status_code=400, detail="Åifre en az 8 karakter olmalÄ±dÄ±r.")
    import re
    pwd_checks = sum([
        bool(re.search(r"[A-Z]", pwd)),
        bool(re.search(r"[a-z]", pwd)),
        bool(re.search(r"\d", pwd)),
        bool(re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", pwd)),
    ])
    if pwd_checks < 2:
        raise HTTPException(status_code=400, detail="Åifre en az bÃ¼yÃ¼k harf, kÃ¼Ã§Ã¼k harf, rakam veya Ã¶zel karakter iÃ§ermelidir.")

    # 1. Create user in Supabase Auth (Auto confirm)
    auth_provider = "supabase"
    local_password_hash = None
    try:
        supa_user = supabase.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True
        })
        if not supa_user or not supa_user.user:
            raise RuntimeError("Failed to retrieve user from Supabase after creation")
        user_id = supa_user.user.id
    except Exception:
        # Local fallback keeps the assignment demo functional even when Supabase blocks admin creation.
        auth_provider = "local"
        user_id = str(uuid.uuid4())
        local_password_hash = hash_local_password(body.password)

    # 2. Store user profile in MongoDB
    user_doc = {
        "user_id": user_id,
        "email": body.email,
        "role": UserRole.CUSTOMER.value,  # Force customer role
        "auth_provider": auth_provider,
        "local_password_hash": local_password_hash,
        "is_active": True,
        "kyc_status": "PENDING",
        "created_at": datetime.now(timezone.utc),
    }

    await db.users.insert_one(user_doc)
    await sync_user(user_doc)
    
    # 3. Create Customer Profile in MongoDB
    customer_doc = {
        "customer_id": str(uuid.uuid4()),
        "user_id": user_id,
        "full_name": body.full_name,
        "national_id": body.national_id,
        "phone": body.phone,
        "date_of_birth": None,
        "address": None,
        "status": "pending",
        "kyc_verified": False,
        "id_front_url": None,
        "id_back_url": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.customers.insert_one(customer_doc)
    await sync_customer(customer_doc)

    ip, ua = get_client_info(request)

    await log_audit(
        action="REGISTER",
        outcome="SUCCESS",
        user_id=user_id,
        user_email=body.email,
        role=UserRole.CUSTOMER.value,
        details="New customer account created via Supabase",
        ip_address=ip,
        user_agent=ua,
    )

    # 4. Generate OTP and send verification email
    import asyncio
    otp_code = str(random.randint(100000, 999999))
    await db.verification_codes.insert_one({
        "email": body.email,
        "code": otp_code,
        "full_name": body.full_name,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "used": False,
    })
    
    asyncio.create_task(send_verification_email(body.email, otp_code, body.full_name))
    
    telegram_msg = f"\U0001f389 <b>Yeni M\u00fc\u015fteri Kayd\u0131:</b>\n\n\U0001f464 Ad\u0131: {body.full_name}\n\U0001f4e7 Email: {body.email}\n\U0001f4f1 Telefon: {body.phone}"
    asyncio.create_task(send_telegram_message(telegram_msg))

    return UserResponse(
        id=user_doc["user_id"],
        email=user_doc["email"],
        role=user_doc["role"],
        is_active=user_doc["is_active"],
        kyc_status=user_doc["kyc_status"],
        created_at=user_doc["created_at"],
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    body: UserLoginRequest,
    request: Request,
    db=Depends(get_database),
):
    """Login and receive a Supabase JWT token with redirect URL based on role."""
    ip, ua = get_client_info(request)

    # 1. Get user profile from local MongoDB first
    user = await db.users.find_one({"email": body.email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User identity found, but local profile is missing. Please contact support.",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # 2. Authenticate based on provider
    auth_provider = user.get("auth_provider", "supabase")
    token = None

    if auth_provider == "local":
        if not verify_local_password(body.password, user.get("local_password_hash")):
            await log_audit(
                action="LOGIN_FAILED",
                outcome="FAILURE",
                user_email=body.email,
                details="Local auth failed: invalid password",
                ip_address=ip,
                user_agent=ua,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        token = create_local_access_token(user)
    else:
        try:
            auth_response = supabase.auth.sign_in_with_password({
                "email": body.email,
                "password": body.password
            })
            session = auth_response.session
            if not session:
                raise ValueError("No session returned")
            token = session.access_token
        except Exception as e:
            # If user has local hash as backup, allow local sign-in.
            if verify_local_password(body.password, user.get("local_password_hash")):
                token = create_local_access_token(user)
            else:
                await log_audit(
                    action="LOGIN_FAILED",
                    outcome="FAILURE",
                    user_email=body.email,
                    details=f"Supabase auth failed: {str(e)}",
                    ip_address=ip,
                    user_agent=ua,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )

    await log_audit(
        action="LOGIN_SUCCESS",
        outcome="SUCCESS",
        user_id=user["user_id"],
        user_email=user["email"],
        role=user["role"],
        ip_address=ip,
        user_agent=ua,
    )

    return TokenResponse(
        access_token=token,
        role=user["role"],
        email=user["email"],
        redirect_url=get_redirect_url(user["role"]),
    )


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile with redirect URL."""
    return MeResponse(
        id=current_user["user_id"],
        email=current_user["email"],
        role=current_user["role"],
        is_active=current_user.get("is_active", True),
        kyc_status=current_user.get("kyc_status", "PENDING"),
        created_at=current_user["created_at"],
        redirect_url=get_redirect_url(current_user["role"]),
    )


@router.post("/verify-email")
async def verify_email(body: EmailVerifyRequest, db=Depends(get_database)):
    """Verify email with 6-digit OTP code."""
    record = await db.verification_codes.find_one({
        "email": body.email,
        "code": body.code,
        "used": False,
    })

    if not record:
        raise HTTPException(status_code=400, detail="GeÃ§ersiz doÄŸrulama kodu.")

    if record["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="DoÄŸrulama kodunun sÃ¼resi dolmuÅŸ. LÃ¼tfen yeni kod isteyin.")

    # Mark code as used
    await db.verification_codes.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )

    # Activate user
    await db.users.update_one(
        {"email": body.email},
        {"$set": {"is_active": True, "email_verified": True}}
    )

    # Send welcome email now that they're verified
    import asyncio
    asyncio.create_task(send_welcome_email(body.email, record.get("full_name", "")))

    return {"message": "E-posta baÅŸarÄ±yla doÄŸrulandÄ±! GiriÅŸ yapabilirsiniz.", "verified": True}


@router.post("/resend-code")
async def resend_code(body: ResendCodeRequest, db=Depends(get_database)):
    """Resend a new verification code."""
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="KullanÄ±cÄ± bulunamadÄ±.")

    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="E-posta zaten doÄŸrulanmÄ±ÅŸ.")

    # Invalidate old codes
    await db.verification_codes.update_many(
        {"email": body.email, "used": False},
        {"$set": {"used": True}}
    )

    # Generate new code
    new_code = str(random.randint(100000, 999999))
    await db.verification_codes.insert_one({
        "email": body.email,
        "code": new_code,
        "full_name": user.get("full_name", ""),
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "used": False,
    })

    import asyncio
    asyncio.create_task(send_verification_email(body.email, new_code, user.get("full_name", "")))

    return {"message": "Yeni doÄŸrulama kodu e-posta adresinize gÃ¶nderildi."}


@router.post("/change-password")
async def change_password(
    body: dict,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Change the current user's password via Supabase Auth."""
    current_password = body.get("current_password")
    new_password = body.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Mevcut ve yeni ÅŸifre gereklidir.")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Yeni ÅŸifre en az 8 karakter olmalÄ±dÄ±r.")

    # Verify current password by attempting sign-in
    try:
        supabase.auth.sign_in_with_password({
            "email": current_user["email"],
            "password": current_password,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Mevcut ÅŸifre yanlÄ±ÅŸ.")

    # Update password via Supabase Admin API
    try:
        supabase.auth.admin.update_user_by_id(
            current_user["user_id"],
            {"password": new_password}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Åifre gÃ¼ncellenemedi: {str(e)}")

    ip, ua = get_client_info(request)
    await log_audit(
        action="PASSWORD_CHANGED",
        outcome="SUCCESS",
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        role=current_user["role"],
        details="Password changed via profile settings",
        ip_address=ip,
        user_agent=ua,
    )

    return {"message": "Åifreniz baÅŸarÄ±yla deÄŸiÅŸtirildi."}


@router.get("/seed-ceo", include_in_schema=False)
async def seed_ceo(request: Request, db=Depends(get_database)):
    """Seed privileged accounts for local development only."""
    require_dev_seed_access(request)
    created_credentials = []

    existing_ceo = await db.users.find_one({"email": "ceo@finbank.com"})
    if not existing_ceo:
        try:
            ceo_password = secrets.token_urlsafe(18)
            supa_ceo = supabase.auth.admin.create_user({
                "email": "ceo@finbank.com",
                "password": ceo_password,
                "email_confirm": True,
            })
            if supa_ceo and supa_ceo.user:
                user_doc_ceo = {
                    "user_id": supa_ceo.user.id,
                    "email": "ceo@finbank.com",
                    "role": "ceo",
                    "is_active": True,
                    "kyc_status": "APPROVED",
                    "created_at": datetime.now(timezone.utc),
                }
                await db.users.insert_one(user_doc_ceo)
                created_credentials.append(
                    {
                        "role": "ceo",
                        "email": "ceo@finbank.com",
                        "password": ceo_password,
                    }
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"CEO bootstrap failed: {e}",
            )

    existing_employee = await db.users.find_one({"email": "employee@finbank.com"})
    if not existing_employee:
        try:
            employee_password = secrets.token_urlsafe(18)
            supa_emp = supabase.auth.admin.create_user({
                "email": "employee@finbank.com",
                "password": employee_password,
                "email_confirm": True,
            })
            if supa_emp and supa_emp.user:
                user_doc_emp = {
                    "user_id": supa_emp.user.id,
                    "email": "employee@finbank.com",
                    "role": "employee",
                    "is_active": True,
                    "kyc_status": "APPROVED",
                    "created_at": datetime.now(timezone.utc),
                }
                await db.users.insert_one(user_doc_emp)
                created_credentials.append(
                    {
                        "role": "employee",
                        "email": "employee@finbank.com",
                        "password": employee_password,
                    }
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Employee bootstrap failed: {e}",
            )

    if created_credentials:
        return {
            "message": "Development accounts created.",
            "credentials": created_credentials,
        }

    return {"message": "Development accounts already exist."}
