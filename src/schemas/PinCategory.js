const { Schema, model } = require('mongoose');

const schema = new Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  discordCategoryId: { type: String, required: true },
  channelIds: { type: [String], default: [] },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ guildId: 1, discordCategoryId: 1 }, { unique: true });

module.exports = model('PinCategory', schema);
