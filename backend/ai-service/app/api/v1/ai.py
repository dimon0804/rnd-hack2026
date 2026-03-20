from fastapi import APIRouter

from app.schemas.ai import ChatRequest, ChatResponse
from app.services.mistral_client import MistralClient

router = APIRouter()
client = MistralClient()


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    return await client.chat(body)
