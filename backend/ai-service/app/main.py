from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.v1.ai import router as ai_router


def create_app() -> FastAPI:
    app = FastAPI(title="AI Platform AI Service", version="0.1.0")
    app.include_router(health_router)
    app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])
    return app


app = create_app()
