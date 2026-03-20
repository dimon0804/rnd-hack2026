import httpx
from fastapi import APIRouter, Request, Response

from app.api.proxy_auth import filter_request_headers, filter_response_headers
from app.core.config import settings

router = APIRouter()


@router.api_route(
    "/api/v1/rag/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_rag(request: Request, path: str) -> Response:
    base = settings.rag_service_url.rstrip("/")
    url = f"{base}/api/v1/rag/{path}"
    if request.query_params:
        url = f"{url}?{request.query_params}"

    client: httpx.AsyncClient = request.app.state.http_client
    body = await request.body()
    resp = await client.request(
        request.method,
        url,
        headers=filter_request_headers(request),
        content=body,
    )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=filter_response_headers(resp),
    )
