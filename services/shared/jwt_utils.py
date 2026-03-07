"""
FinBank Shared - JWT Utilities
Used by all microservices for token creation and verification.
"""
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from shared.config import settings

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş token.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("user_id")
    email = payload.get("email")
    role = payload.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Geçersiz token.")
    return {"user_id": user_id, "email": email, "role": role}


async def require_role(allowed_roles: list, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if user["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok.")
    return user


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await require_role(["admin"], credentials)


async def require_employee(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await require_role(["employee", "admin"], credentials)


async def require_staff(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await require_role(["employee", "admin", "ceo"], credentials)