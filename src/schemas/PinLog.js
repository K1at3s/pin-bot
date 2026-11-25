const { Schema, model } = require('mongoose');

const schema = new Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, default: null },
  displayName: { type: String, default: null },
  hasTrackedRole: { type: Boolean, default: false },
  channelId: { type: String, required: true },
  discordCategoryId: { type: String, required: true, index: true },
  categoryName: { type: String, required: true },
  messageId: { type: String, required: true },
  photoCount: { type: Number, default: 0 },
  gifCount: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ guildId: 1, messageId: 1 }, { unique: true });
schema.index({ guildId: 1, userId: 1, discordCategoryId: 1 });

module.exports = model('PinLog', schema);
