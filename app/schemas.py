from typing import Any

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    trigger: str = Field(default="INITIAL_ASSESSMENT")


class ServiceCall(BaseModel):
    status: str
    result: Any = None
    error: dict[str, Any] | None = None
