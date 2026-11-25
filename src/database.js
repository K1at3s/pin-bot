/*
 * Minimal MongoDB connection for standalone pin bot.
 * Mongoose 9.x compatible.
 */

const mongoose = require('mongoose');

// Schemas used by this bot (very minimal, just PinLog)
const PinLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, required: true },
  userId: { type: String },
  displayName: { type: String },
  channelId: { type: String },
  totalCount: { type: Number, default: 1 },
  fileCount: { type: Number, default: 0 },
  photoCount: { type: Number, default: 0 },
  gifCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Unique index to prevent double counting (guildId + messageId)
PinLogSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

const PinLog = mongoose.model('PinLog', PinLogSchema);

// Server-style schema (for pinTracker config like roleId, ignoredChannelIds)
const ServerSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  pinTracker: {
    roleId: { type: String, default: '' },
    ignoredChannelIds: { type: [String], default: [] },
  },
  updatedAt: { type: Date, default: Date.now },
});
const Server = mongoose.model('Server', ServerSchema);

let connected = false;

async function connect() {
  if (connected) return;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DATABASE || 'ticket_bot';
  try {
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    connected = true;
    console.log(`[DB] Connected to ${dbName} at ${uri}`);
  } catch (error) {
    console.error('[DB] Connection error:', error.message);
    setTimeout(connect, 5000); // retry
  }
}

async function disconnect() {
  try {
    await mongoose.disconnect();
    connected = false;
    console.log('[DB] Disconnected');
  } catch (error) {
    console.error('[DB] Disconnect error:', error.message);
  }
}

module.exports = { connect, disconnect, PinLog, Server };