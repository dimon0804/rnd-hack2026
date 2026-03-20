from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
)
from app.services.password import hash_password, verify_password
from app.services.tokens import (
    create_access_token,
    hash_refresh_token,
    new_refresh_token_value,
)
from app.core.config import settings


class AuthService:
    def __init__(self, db: Session) -> None:
        self._users = UserRepository(db)
        self._refresh = RefreshTokenRepository(db)
        self._db = db

    def register(self, body: RegisterRequest) -> TokenPairResponse:
        if self._users.get_by_email(body.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",
            )
        user = self._users.create(body.email, hash_password(body.password))
        self._db.commit()
        return self._issue_tokens(user.id)

    def login(self, body: LoginRequest) -> TokenPairResponse:
        user = self._users.get_by_email(body.email)
        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )
        return self._issue_tokens(user.id)

    def refresh(self, body: RefreshRequest) -> TokenPairResponse:
        token_hash = hash_refresh_token(body.refresh_token)
        row = self._refresh.get_by_hash(token_hash)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный refresh-токен",
            )
        if row.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Срок действия refresh-токена истёк",
            )
        user_id = row.user_id
        self._refresh.revoke(row)
        self._db.commit()
        return self._issue_tokens(user_id)

    def logout(self, body: RefreshRequest) -> MessageResponse:
        token_hash = hash_refresh_token(body.refresh_token)
        row = self._refresh.get_by_hash(token_hash)
        if row:
            self._refresh.revoke(row)
            self._db.commit()
        return MessageResponse(message="Выход выполнен")

    def _issue_tokens(self, user_id: int) -> TokenPairResponse:
        access_token, expires_in = create_access_token(user_id)
        raw_refresh = new_refresh_token_value()
        token_hash = hash_refresh_token(raw_refresh)
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        self._refresh.create(user_id, token_hash, expires_at)
        self._db.commit()
        return TokenPairResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=expires_in,
        )
