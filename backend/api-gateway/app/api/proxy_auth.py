import httpx
from fastapi import APIRouter, Request, Response

from app.core.config import settings

router = APIRouter()

_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
}


def _filter_request_headers(request: Request) -> dict[str, str]:
    return {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in _HOP_BY_HOP
    }


def _filter_response_headers(resp: httpx.Response) -> dict[str, str]:
    return {
        k: v
        for k, v in resp.headers.items()
        if k.lower() not in _HOP_BY_HOP
    }


@router.api_route(
    "/api/v1/auth/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_auth(request: Request, path: str) -> Response:
    base = settings.auth_service_url.rstrip("/")
    url = f"{base}/api/v1/auth/{path}"
    if request.query_params:
        url = f"{url}?{request.query_params}"

    client: httpx.AsyncClient = request.app.state.http_client
    body = await request.body()

    resp = await client.request(
        request.method,
        url,
        headers=_filter_request_headers(request),
        content=body,
    )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=_filter_response_headers(resp),
    )
