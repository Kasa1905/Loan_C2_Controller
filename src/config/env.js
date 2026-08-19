const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function number(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : Number(value);
}

const config = {
  host: process.env.C2_HOST || '0.0.0.0',
  port: number('C2_PORT', 8010),
  mongoUri: required('MONGODB_URI'),
  mongoUriFallback: process.env.MONGODB_URI_FALLBACK || null,
  mongoDatabase: required('MONGODB_DATABASE'),
  mongoCollection: process.env.MONGODB_COLLECTION || 'finalapplications',
  ruleEngineUrl: required('RULE_ENGINE_URL'),
  ruleEngineEndpoint: process.env.RULE_ENGINE_ENDPOINT || '/policy-rag/evaluate',
  riskEngineUrl: required('RISK_ENGINE_URL'),
  riskEngineEndpoint: process.env.RISK_ENGINE_ENDPOINT || '/risk/evaluate',
  requestTimeoutMs: number('REQUEST_TIMEOUT_MS', 120000),
  riskScoreScale: number('RISK_SCORE_SCALE', 100),
};

if (![10, 100].includes(config.riskScoreScale)) {
  throw new Error('RISK_SCORE_SCALE must be 10 or 100');
}

module.exports = config;
