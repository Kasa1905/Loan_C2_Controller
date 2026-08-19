const dns = require('node:dns');
const http = require('node:http');

dns.setServers([
  '1.1.1.1',
  '8.8.8.8',
]);
const config = require('./config/env');
const app = require('./app');
const { connectMongo, closeMongo } = require('./database/mongo');

async function start() {
  try {
    await connectMongo();
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
  }
  const server = http.createServer(app);
  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Stop the existing process or change C2_PORT.`);
      process.exit(1);
      return;
    }
    console.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });

  server.listen(config.port, config.host, () => {
    console.log(`C2 listening on http://${config.host}:${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await closeMongo();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error(`C2 failed to start: ${error.message}`);
  process.exit(1);
});
