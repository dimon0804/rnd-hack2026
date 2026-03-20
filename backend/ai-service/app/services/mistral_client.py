import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.ai import ChatRequest, ChatResponse


class MistralClient:
    async def chat(self, body: ChatRequest) -> ChatResponse:
        if not settings.mistral_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MISTRAL_API_KEY is not configured",
            )

        payload = {
            "model": settings.mistral_chat_model,
            "messages": [
                {"role": "system", "content": body.system_prompt},
                {"role": "user", "content": body.prompt},
            ],
            "temperature": body.temperature,
            "max_tokens": body.max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {settings.mistral_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{settings.mistral_base_url.rstrip('/')}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Mistral API error: {response.status_code}",
            )

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return ChatResponse(content=content, model=data.get("model", settings.mistral_chat_model))
