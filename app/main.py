from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException

from app.config import get_settings
from app.database import Database
from app.schemas import ProcessRequest
from app.services.orchestrator import Orchestrator
from app.services.risk_engine import RiskEngineClient
from app.services.rule_engine import RuleEngineClient

settings = get_settings()
database = Database(settings)
orchestrator = Orchestrator(
    database=database,
    rule_engine=RuleEngineClient(settings),
    risk_engine=RiskEngineClient(settings),
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    database.close()


app = FastAPI(title="Loan C2 Controller", version=settings.c2_version, lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    try:
        database.ping()
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"service": "C2", "status": "unhealthy", "mongodb": "disconnected"}) from exc
    return {"service": "C2", "status": "healthy", "mongodb": "connected"}


@app.post("/api/c2/process/{application_id}")
async def process_application(application_id: str, request: ProcessRequest | None = None) -> dict[str, Any]:
    trigger = request.trigger if request is not None else "INITIAL_ASSESSMENT"
    try:
        return await orchestrator.process(application_id, trigger)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
