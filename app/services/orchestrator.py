from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import Database
from app.schemas import ServiceCall
from app.services.risk_engine import RiskEngineClient
from app.services.rule_engine import RuleEngineClient


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if value.__class__.__name__ == "ObjectId":
        return str(value)
    return value


class Orchestrator:
    def __init__(
        self,
        database: Database,
        rule_engine: RuleEngineClient,
        risk_engine: RiskEngineClient,
    ) -> None:
        self.database = database
        self.rule_engine = rule_engine
        self.risk_engine = risk_engine

    async def process(self, application_id: str, trigger: str) -> dict[str, Any]:
        application = self.database.get_application(application_id)
        if application is None:
            raise LookupError(f"Application {application_id} was not found")

        safe_application = _json_safe(application)
        risk_assessment = application.get("riskAssessment")
        if not isinstance(risk_assessment, dict):
            risk_assessment = {}
        history = risk_assessment.get("history")
        if not isinstance(history, list):
            history = []
        previous = risk_assessment.get("current")
        if not isinstance(previous, dict):
            previous = None

        iteration_number = len(history) + 1
        timestamp = datetime.now(timezone.utc).isoformat()
        iteration = {
            "iterationId": str(uuid4()),
            "number": iteration_number,
            "trigger": trigger,
            "timestamp": timestamp,
        }

        rule_call = await self.rule_engine.evaluate(application_id)
        risk_input = self._build_risk_input(
            application_id,
            safe_application,
            rule_call,
            previous,
            iteration,
        )
        risk_call = await self.risk_engine.evaluate(risk_input)

        result = risk_call.result if isinstance(risk_call.result, dict) else None
        current = {
            **iteration,
            "status": risk_call.status,
            "score": result.get("score") if result else None,
            "riskLevel": result.get("riskLevel") if result else None,
            "result": result,
        }
        if risk_call.error is not None:
            current["error"] = risk_call.error
        history_entry = dict(current)
        self.database.save_risk_assessment(
            application_id,
            current,
            history_entry,
            result,
        )

        return {
            "applicationId": application_id,
            "iteration": iteration,
            "ruleEngine": rule_call.model_dump(),
            "riskInput": risk_input,
            "riskDetection": risk_call.model_dump(),
            "riskAssessment": {"current": current, "historyEntry": history_entry},
        }

    @staticmethod
    def _build_risk_input(
        application_id: str,
        application: dict[str, Any],
        rule_call: ServiceCall,
        previous: dict[str, Any] | None,
        iteration: dict[str, Any],
    ) -> dict[str, Any]:
        document_processing = {
            "status": application.get("processingStatus"),
            "profileStatus": application.get("profileStatus"),
            "verificationStatus": application.get("verificationStatus"),
            "verificationScore": application.get("verificationScore"),
            "digitalProfile": application.get("digitalProfile"),
            "documents": application.get("documents") if isinstance(application.get("documents"), list) else [],
        }
        application_data = {
            "applicationId": application_id,
            "applicantDetails": application.get("applicantDetails") or {},
            "financialDetails": application.get("financialDetails") or {},
            "loanDetails": application.get("loanDetails") or {},
            "documents": document_processing["documents"],
            "processingStatus": application.get("processingStatus"),
            "profileStatus": application.get("profileStatus"),
            "eligibilityStatus": application.get("eligibilityStatus"),
            "eligibilityScore": application.get("eligibilityScore"),
        }
        previous_assessment = {
            "available": previous is not None,
            "iteration": previous.get("number") if previous else None,
            "score": previous.get("score") if previous else None,
            "riskLevel": previous.get("riskLevel") if previous else None,
        }
        return {
            "schemaVersion": "1.0",
            "source": "C2",
            "application": application_data,
            "documentProcessing": document_processing,
            "ruleEngine": {
                "status": rule_call.status,
                "result": rule_call.result,
                "error": rule_call.error,
            },
            "previousRiskAssessment": previous_assessment,
            "iteration": iteration,
        }
