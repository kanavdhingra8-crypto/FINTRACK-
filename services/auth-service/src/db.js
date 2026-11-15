const mongoose = require('mongoose');
const { env } = require('./config');

async function connectToDatabase() {
  await mongoose.connect(env.AUTH_MONGODB_URI);
}

async function disconnectFromDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectToDatabase, disconnectFromDatabase };
