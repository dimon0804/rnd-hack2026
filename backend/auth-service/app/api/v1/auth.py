from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
)
from app.services.auth_service import AuthService

router = APIRouter()


def auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=TokenPairResponse)
def register(body: RegisterRequest, svc: AuthService = Depends(auth_service)) -> TokenPairResponse:
    return svc.register(body)


@router.post("/login", response_model=TokenPairResponse)
def login(body: LoginRequest, svc: AuthService = Depends(auth_service)) -> TokenPairResponse:
    return svc.login(body)


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_tokens(body: RefreshRequest, svc: AuthService = Depends(auth_service)) -> TokenPairResponse:
    return svc.refresh(body)


@router.post("/logout", response_model=MessageResponse)
def logout(body: RefreshRequest, svc: AuthService = Depends(auth_service)) -> MessageResponse:
    return svc.logout(body)
