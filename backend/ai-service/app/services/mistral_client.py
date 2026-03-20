import httpx
from fastapi import HTTPException, status
from mistralai.client import Mistral

from app.core.config import settings
from app.schemas.ai import ChatRequest, ChatResponse


class MistralClient:
    async def chat(self, body: ChatRequest) -> ChatResponse:
        if not settings.mistral_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MISTRAL_API_KEY is not configured",
            )

        timeout = httpx.Timeout(settings.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as http:
            async with Mistral(
                api_key=settings.mistral_api_key,
                server_url=settings.mistral_base_url.rstrip("/"),
                async_client=http,
            ) as mistral:
                try:
                    res = await mistral.chat.complete_async(
                        model=settings.mistral_chat_model,
                        messages=[
                            {"role": "system", "content": body.system_prompt},
                            {"role": "user", "content": body.prompt},
                        ],
                        temperature=body.temperature,
                        max_tokens=body.max_tokens,
                        stream=False,
                    )
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Mistral API error: {exc}",
                    ) from exc

        choice = res.choices[0]
        msg = choice.message
        content = msg.content if getattr(msg, "content", None) is not None else ""
        model_name = getattr(res, "model", None) or settings.mistral_chat_model
        return ChatResponse(content=content, model=model_name)
