from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.health import router as health_router
from app.api.proxy_ai import router as proxy_ai_router
from app.api.proxy_auth import router as proxy_auth_router
from app.api.proxy_documents import router as proxy_documents_router
from app.api.proxy_rag import router as proxy_rag_router
from app.api.simulator import router as simulator_router
from app.api.stock_image import router as stock_image_router
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=300.0) as client:
        app.state.http_client = client
        yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Platform API Gateway",
        version="0.1.0",
        description="Единая точка входа; дальше — прокси к микросервисам.",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    app.include_router(health_router)
    app.include_router(proxy_auth_router)
    app.include_router(proxy_documents_router)
    app.include_router(proxy_rag_router)
    app.include_router(proxy_ai_router)
    app.include_router(stock_image_router)
    app.include_router(simulator_router)

    @app.get("/")
    @limiter.limit(f"{settings.rate_limit_per_minute}/minute")
    async def root(request: Request) -> dict[str, str]:
        return {"message": "AI Platform API Gateway", "docs": "/docs"}

    return app


app = create_app()
