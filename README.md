# Loan C2 Controller

Node.js/Express/Mongoose orchestration service connecting MongoDB applications to the external Rule Engine and Risk Detection service.

## Setup

```bash
npm install
cp .env.example .env
```

Configure `.env` with MongoDB Atlas credentials, the Rule Engine URL/endpoint, and the Risk Detection URL/endpoint.

If your machine cannot resolve Atlas SRV records (for example `querySrv EBADRESP`), set `MONGODB_URI_FALLBACK` to the standard (non-SRV) Atlas connection string (`mongodb://...`) and keep `MONGODB_URI` as-is. C2 will automatically retry using the fallback URI when SRV DNS resolution fails.

## Start

```bash
npm start
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

The response includes the canonical `riskInput`, complete Rule Engine and Risk Detection responses, and the persisted assessment. A request without a body uses `INITIAL_ASSESSMENT`.

`RISK_SCORE_SCALE` may be `10` or `100`. The original Risk Detection score is preserved in `result.score`; C2 additionally stores `normalizedScore`.

## MongoDB verification

```javascript
db.finalapplications.findOne(
  { _id: ObjectId("6a845dad59c737ee08fad902") },
  { riskAssessment: 1, riskLevel: 1, riskFlags: 1, updatedAt: 1 }
)
```

`riskAssessment.current` contains the latest successful assessment and `riskAssessment.history` contains every iteration, including failed ones. Running the process command twice should produce history entries with numbers `1` and `2`.
