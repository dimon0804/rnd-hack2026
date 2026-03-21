import httpx
from fastapi import HTTPException, status
from mistralai import Mistral

from app.core.config import settings
from app.schemas.ai import ChatRequest, ChatResponse


class MistralClient:
    async def chat(self, body: ChatRequest) -> ChatResponse:
        if settings.llm_mode == "openai_http":
            return await self._chat_openai_http(body)
        return await self._chat_mistral_sdk(body)

    async def _chat_openai_http(self, body: ChatRequest) -> ChatResponse:
        if not settings.mistral_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MISTRAL_API_KEY is not configured",
            )

        base = settings.mistral_base_url.rstrip("/")
        url = f"{base}/v1/chat/completions"
        payload: dict = {
            "model": settings.mistral_chat_model,
            "messages": [
                {"role": "system", "content": body.system_prompt},
                {"role": "user", "content": body.prompt},
            ],
            "temperature": body.temperature,
            "max_tokens": body.max_tokens,
        }
        if body.json_mode:
            payload["response_format"] = {"type": "json_object"}

        timeout = httpx.Timeout(settings.request_timeout_seconds)
        headers = {
            "Authorization": f"Bearer {settings.mistral_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=timeout) as http:
            try:
                r = await http.post(url, json=payload, headers=headers)
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LLM endpoint unreachable: {exc}",
                ) from exc

        # Часть OpenAI-совместимых прокси не знает response_format — повтор без json_mode.
        if r.status_code in (400, 422) and body.json_mode and "response_format" in payload:
            payload.pop("response_format", None)
            async with httpx.AsyncClient(timeout=timeout) as http2:
                try:
                    r = await http2.post(url, json=payload, headers=headers)
                except httpx.RequestError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"LLM endpoint unreachable: {exc}",
                    ) from exc

        if r.status_code >= 400:
            text = (r.text or "")[:800]
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM HTTP {r.status_code}: {text}",
            )

        try:
            data = r.json()
            choices = data.get("choices") or []
            if not choices:
                raise KeyError("no choices")
            msg = choices[0].get("message") or {}
            content = msg.get("content")
            if content is None:
                content = ""
            elif not isinstance(content, str):
                content = str(content)
        except (KeyError, ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unexpected LLM response shape: {exc}",
            ) from exc

        model_name = data.get("model") or settings.mistral_chat_model
        return ChatResponse(content=content, model=model_name)

    async def _chat_mistral_sdk(self, body: ChatRequest) -> ChatResponse:
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
                sdk_kwargs: dict = {
                    "model": settings.mistral_chat_model,
                    "messages": [
                        {"role": "system", "content": body.system_prompt},
                        {"role": "user", "content": body.prompt},
                    ],
                    "temperature": body.temperature,
                    "max_tokens": body.max_tokens,
                    "stream": False,
                }
                if body.json_mode:
                    sdk_kwargs["response_format"] = {"type": "json_object"}
                try:
                    res = await mistral.chat.complete_async(**sdk_kwargs)
                except Exception as exc:
                    if not body.json_mode or "response_format" not in sdk_kwargs:
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Mistral API error: {exc}",
                        ) from exc
                    sdk_kwargs.pop("response_format", None)
                    try:
                        res = await mistral.chat.complete_async(**sdk_kwargs)
                    except Exception as exc2:
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Mistral API error: {exc2}",
                        ) from exc2

        choice = res.choices[0]
        msg = choice.message
        content = msg.content if getattr(msg, "content", None) is not None else ""
        model_name = getattr(res, "model", None) or settings.mistral_chat_model
        return ChatResponse(content=content, model=model_name)
