from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)


def decode_user_id(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "access":
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except jwt.PyJWTError:
        return None


async def get_current_user_id_optional(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> int | None:
    if creds is None:
        return None
    uid = decode_user_id(creds.credentials)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return uid


async def require_user_or_anonymous(
    user_id: int | None = Depends(get_current_user_id_optional),
) -> int | None:
    if user_id is not None:
        return user_id
    if settings.allow_anonymous_upload:
        return None
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )
