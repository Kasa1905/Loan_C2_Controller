const mongoose = require('mongoose');
const config = require('../config/env');

function isSrvDnsError(error) {
  if (!error) {
    return false;
  }
  const message = String(error.message || '');
  return (
    message.includes('querySrv')
    || error.code === 'EBADRESP'
    || error.code === 'ENOTFOUND'
  );
}

async function connectMongo() {
  const options = {
    dbName: config.mongoDatabase,
    serverSelectionTimeoutMS: 5000,
  };

  try {
    await mongoose.connect(config.mongoUri, options);
    return;
  } catch (error) {
    if (!config.mongoUriFallback || !isSrvDnsError(error)) {
      throw error;
    }

    await mongoose.disconnect().catch(() => undefined);
    await mongoose.connect(config.mongoUriFallback, options);
  }
}

function getCollection() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready');
  }
  return mongoose.connection.db.collection(config.mongoCollection);
}

async function pingMongo() {
  await mongoose.connection.db.command({ ping: 1 });
}

async function closeMongo() {
  await mongoose.disconnect();
}

module.exports = { connectMongo, getCollection, pingMongo, closeMongo };
