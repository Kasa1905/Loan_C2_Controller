import httpx

from app.config import Settings
from app.schemas import ServiceCall


class RiskEngineClient:
    def __init__(self, settings: Settings) -> None:
        self.url = f"{settings.risk_engine_url.rstrip('/')}/{settings.risk_engine_endpoint.lstrip('/')}"
        self.timeout = settings.request_timeout_seconds

    async def evaluate(self, payload: dict) -> ServiceCall:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.url, json=payload)
                response.raise_for_status()
                return ServiceCall(status="ASSESSED", result=response.json())
        except httpx.HTTPStatusError as exc:
            return ServiceCall(
                status="FAILED",
                error={
                    "type": "HTTP_ERROR",
                    "message": str(exc),
                    "statusCode": exc.response.status_code,
                },
            )
        except (httpx.HTTPError, ValueError) as exc:
            return ServiceCall(
                status="FAILED",
                error={"type": "SERVICE_ERROR", "message": str(exc)},
            )
