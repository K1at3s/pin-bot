const { Schema, model } = require('mongoose');

const schema = new Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, default: null },
  displayName: { type: String, default: null },
  hasTrackedRole: { type: Boolean, default: false },
  discordCategoryId: { type: String, required: true },
  categoryName: { type: String, required: true },
  photoCount: { type: Number, default: 0 },
  gifCount: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ guildId: 1, userId: 1, discordCategoryId: 1 }, { unique: true });

module.exports = model('PinStat', schema);
