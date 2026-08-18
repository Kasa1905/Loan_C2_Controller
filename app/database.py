from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import MongoClient

from app.config import Settings


class Database:
    def __init__(self, settings: Settings) -> None:
        self.client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        self.collection = self.client[settings.mongodb_database][settings.mongodb_collection]

    def ping(self) -> None:
        self.client.admin.command("ping")

    def get_application(self, application_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(application_id):
            return None
        return self.collection.find_one({"_id": ObjectId(application_id)})

    def save_risk_assessment(
        self,
        application_id: str,
        current: dict[str, Any],
        history_entry: dict[str, Any],
        risk_result: Any,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        update: dict[str, Any] = {
            "$set": {
                "riskAssessment.current": current,
                "updatedAt": now,
            },
            "$push": {"riskAssessment.history": history_entry},
        }

        if isinstance(risk_result, dict):
            optional_fields = {
                "riskLevel": risk_result.get("riskLevel"),
                "riskFlags": risk_result.get("riskFlags"),
                "eligibilityStatus": risk_result.get("eligibilityStatus"),
                "eligibilityScore": risk_result.get("eligibilityScore"),
                "eligibilityReason": risk_result.get("eligibilityReason"),
            }
            for field_name, value in optional_fields.items():
                if field_name in risk_result:
                    update["$set"][field_name] = value

        result = self.collection.update_one(
            {"_id": ObjectId(application_id)},
            update,
        )
        if result.matched_count != 1:
            raise LookupError(f"Application {application_id} was not found during update")

    def close(self) -> None:
        self.client.close()
