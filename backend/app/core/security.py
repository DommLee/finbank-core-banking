"""
FinBank Core Banking System - Security (Supabase Auth + RBAC)
"""
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from supabase import create_client, Client
from threading import Lock
from app.core.config import settings
from app.core.database import get_database

_supabase_client = None
_supabase_lock = Lock()
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_supabase_client() -> Client:
    """Create the Supabase client lazily so missing config fails cleanly."""
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase ayarlari eksik. SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunludur."
        )

    with _supabase_lock:
        if _supabase_client is None:
            _supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )

    return _supabase_client


class LazySupabaseClient:
    def __getattr__(self, name):
        return getattr(get_supabase_client(), name)


# Backwards-compatible proxy for existing imports.
supabase = LazySupabaseClient()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ROLE_REDIRECTS = {
    "customer": "/customer/dashboard",
    "employee": "/employee/portal",
    "ceo": "/executive/cockpit",
    "admin": "/admin/dashboard",
}


def get_redirect_url(role: str) -> str:
    """Get the default redirect URL for a given role."""
    return ROLE_REDIRECTS.get(role, "/")


def hash_local_password(password: str) -> str:
    """Hash a local fallback password."""
    return _pwd_context.hash(password)


def verify_local_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify local fallback password hash."""
    if not hashed_password:
        return False
    return _pwd_context.verify(plain_password, hashed_password)


def create_local_access_token(user: dict) -> str:
    """Create a local JWT token when Supabase auth is unavailable."""
    secret = settings.JWT_SECRET or "dev-local-jwt-secret-change-me"
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user["user_id"],
        "email": user["email"],
        "provider": "local",
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_database),
) -> dict:
    """Dependency: get current authenticated user from Supabase JWT."""
    return await authenticate_token(token, db)


async def authenticate_token(token: str, db) -> dict:
    """Validate a Supabase token and return local user record."""
    email = None
    user = None

    try:
        user_response = get_supabase_client().auth.get_user(token)
        if not user_response or not user_response.user:
            raise ValueError("No user returned")
        email = user_response.user.email
    except Exception:
        email = None

    if email:
        user = await db.users.find_one({"email": email})
    else:
        # Local JWT fallback
        try:
            secret = settings.JWT_SECRET or "dev-local-jwt-secret-change-me"
            payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            provider = payload.get("provider")
            if not user_id or provider != "local":
                raise ValueError("Invalid local token payload")
            user = await db.users.find_one({"user_id": user_id})
        except (JWTError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if user is None and email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in local database",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in local database",
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    user["_id"] = str(user["_id"])
    return user


def require_role(required_role: str):
    """Dependency factory: require a specific role."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}",
            )
        return current_user
    return role_checker


def require_roles(*allowed_roles: str):
    """Dependency factory: require any of the specified roles."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Allowed roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


require_admin = require_role("admin")
require_customer = require_role("customer")
require_employee = require_role("employee")
require_ceo = require_role("ceo")

require_staff = require_roles("employee", "admin")
require_management = require_roles("ceo", "admin")
require_any_internal = require_roles("employee", "ceo", "admin")
