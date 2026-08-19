const express = require('express');
const c2Routes = require('./routes/c2.routes');
const { pingMongo } = require('./database/mongo');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pingMongo();
    res.status(200).json({ service: 'C2', status: 'healthy', mongodb: 'connected' });
  } catch {
    res.status(503).json({ service: 'C2', status: 'unhealthy', mongodb: 'disconnected' });
  }
});

app.use('/api/c2', c2Routes);

app.use((error, _req, res, _next) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  res.status(statusCode).json({
    status: statusCode >= 500 ? 'FAILED' : 'ERROR',
    error: error.message || 'Internal server error',
  });
});

module.exports = app;
