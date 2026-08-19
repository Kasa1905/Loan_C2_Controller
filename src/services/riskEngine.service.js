const config = require('../config/env');

function endpointUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}

async function evaluate(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(endpointUrl(config.riskEngineUrl, config.riskEngineEndpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let result;
    try {
      result = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      result = rawBody;
    }

    if (!response.ok) {
      return {
        status: 'FAILED',
        result: null,
        error: { type: 'HTTP_ERROR', message: `Risk Detection returned HTTP ${response.status}`, statusCode: response.status, details: result },
      };
    }
    return { status: 'COMPLETED', result, error: null };
  } catch (error) {
    return {
      status: 'FAILED',
      result: null,
      error: { type: error.name === 'AbortError' ? 'TIMEOUT' : 'SERVICE_ERROR', message: error.message },
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { evaluate };
