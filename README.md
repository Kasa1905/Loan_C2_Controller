# Loan C2 Controller

FastAPI orchestration service connecting the existing MongoDB loan applications, external Rule Engine, and external Risk Detection service.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Configure `.env` with the MongoDB database and the URLs/endpoints of the Rule Engine and Risk Detection services.

## Start

```bash
source .venv/bin/activate
uvicorn app.main:app --host ${C2_HOST:-0.0.0.0} --port ${C2_PORT:-8010}
```

## Health

```bash
curl http://localhost:8010/health
```

Expected response when MongoDB is reachable:

```json
{"service":"C2","status":"healthy","mongodb":"connected"}
```

## Process an application

Replace the id with an existing MongoDB `finalapplications._id` value:

```bash
curl -X POST "http://localhost:8010/api/c2/process/6a845dad59c737ee08fad902" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"INITIAL_ASSESSMENT"}'
```

The response includes the canonical `riskInput`, complete Rule Engine and Risk Detection responses, and the persisted current assessment. A request without a body uses `INITIAL_ASSESSMENT`.

## MongoDB verification

```javascript
db.finalapplications.findOne(
  { _id: ObjectId("6a845dad59c737ee08fad902") },
  { riskAssessment: 1, riskLevel: 1, riskFlags: 1, updatedAt: 1 }
)
```

`riskAssessment.current` contains the latest iteration and `riskAssessment.history` contains every iteration, including failed ones. Running the process command twice should produce history entries with numbers `1` and `2`.
