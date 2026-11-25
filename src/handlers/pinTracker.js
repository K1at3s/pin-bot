const { ChannelType } = require('discord.js');
const PinCategory = require('../schemas/PinCategory');
const PinLog = require('../schemas/PinLog');
const PinStat = require('../schemas/PinStat');
const Server = require('../schemas/Server');
const logger = require('./logger');

const trackedCache = new Map(); // guildId -> { expires, byChannelId, roleId }
const CACHE_TTL_MS = 30000;

function countAttachments(attachments) {
  let photo = 0;
  let gif = 0;
  let files = 0;
  for (const att of attachments?.values?.() || []) {
    files += 1;
    const ct = String(att.contentType || '').toLowerCase();
    const name = String(att.name || att.url || '').toLowerCase();
    const isGif = ct.startsWith('image/gif') || /\.gif($|\?)/i.test(name);
    const isImage = ct.startsWith('image/')
      || /\.(png|jpe?g|jfif|webp|bmp|tiff?|avif|heic|heif|apng|ico)($|\?)/i.test(name)
      || (att.width && att.height && !ct.startsWith('video/'));
    if (isGif) gif += 1;
    else if (isImage) photo += 1;
  }
  return { photo, gif, files };
}

// A "pin" is ONE message that contains at least one uploaded file.
// This matches Discord search, where a 10-file message is a single result.
// photo/gif/files are attachment-level counters kept for the breakdown.
function countMedia(message) {
  const own = countAttachments(message.attachments);
  let photo = own.photo;
  let gif = own.gif;
  let files = own.files;

  // Forwarded message snapshots also contain real uploaded files.
  for (const snap of message.messageSnapshots?.values?.() || []) {
    const snapMsg = snap?.message || snap;
    const sa = countAttachments(snapMsg?.attachments);
    photo += sa.photo;
    gif += sa.gif;
    files += sa.files;
  }

  return { photo, gif, files, total: files > 0 ? 1 : 0 };
}

function invalidatePinCache(guildId) {
  trackedCache.delete(guildId);
}

async function getTrackedConfig(guildId) {
  const now = Date.now();
  const cached = trackedCache.get(guildId);
  if (cached && cached.expires > now) return cached;
  const [categories, server] = await Promise.all([
    PinCategory.find({ guildId, enabled: true }).lean(),
    Server.findOne({ guildId }).select('pinTracker').lean(),
  ]);
  const byChannelId = new Map();
  for (const category of categories) {
    for (const channelId of category.channelIds || []) {
      byChannelId.set(channelId, category);
    }
  }
  const config = {
    expires: now + CACHE_TTL_MS,
    byChannelId,
    roleId: server?.pinTracker?.roleId || null,
    ignoredChannelIds: Array.isArray(server?.pinTracker?.ignoredChannelIds) ? server.pinTracker.ignoredChannelIds : [],
  };
  trackedCache.set(guildId, config);
  return config;
}

async function getTrackedChannels(guildId) {
  const config = await getTrackedConfig(guildId);
  return config.byChannelId;
}

async function recordMessage(message) {
  if (!message?.guildId || !message?.id || message.author?.bot || message.webhookId) return null;
  const media = countMedia(message);
  if (!media.total) return null;

  const { byChannelId, roleId, ignoredChannelIds } = await getTrackedConfig(message.guildId);
  if (ignoredChannelIds.includes(message.channelId)
    || (message.channel?.parentId && ignoredChannelIds.includes(message.channel.parentId))) return null;

  let category = byChannelId.get(message.channelId);
  if (!category) {
    let parentId = message.channel?.parentId;
    if (!parentId) return null;
    // Thread messages point at their parent text channel; walk one level up to the category.
    const parent = message.guild?.channels?.cache?.get(parentId)
      || await message.guild?.channels?.fetch?.(parentId).catch(() => null);
    if (parent && parent.type !== ChannelType.GuildCategory) {
      parentId = parent.parentId || parentId;
    }
    category = await PinCategory.findOne({ guildId: message.guildId, discordCategoryId: parentId, enabled: true }).lean();
    if (!category) return null;
    // Only persist top-level channels; thread ids must not pollute the tracked channel list.
    if (message.channel?.isThread?.() !== true) {
      await PinCategory.updateOne({ _id: category._id }, { $addToSet: { channelIds: message.channelId } }).catch(() => {});
      category.channelIds = [...new Set([...(category.channelIds || []), message.channelId])];
    }
    byChannelId.set(message.channelId, category);
  }

  let member = message.member;
  if (!member) member = await message.guild?.members?.fetch?.(message.author.id).catch(() => null);
  const hasTrackedRole = Boolean(roleId && member?.roles?.cache?.has(roleId));

  const username = message.author.username || null;
  const displayName = member?.displayName || message.author.globalName || message.author.username || null;

  try {
    await PinLog.create({
      guildId: message.guildId,
      userId: message.author.id,
      username,
      displayName,
      hasTrackedRole,
      channelId: message.channelId,
      discordCategoryId: category.discordCategoryId,
      categoryName: category.name,
      messageId: message.id,
      photoCount: media.photo,
      gifCount: media.gif,
      fileCount: media.files,
      totalCount: media.total,
      createdAt: message.createdAt || new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) return { counted: false, duplicate: true }; // already counted
    throw error;
  }

  const statUpdate = {
    $set: { categoryName: category.name, lastMessageAt: message.createdAt || new Date(), username, displayName },
    $inc: { photoCount: media.photo, gifCount: media.gif, fileCount: media.files, totalCount: media.total },
    $setOnInsert: { guildId: message.guildId, userId: message.author.id, discordCategoryId: category.discordCategoryId },
  };
  // Never put the same field in both $set and $setOnInsert (MongoDB path conflict).
  if (hasTrackedRole) statUpdate.$set.hasTrackedRole = true;
  await PinStat.findOneAndUpdate(
    { guildId: message.guildId, userId: message.author.id, discordCategoryId: category.discordCategoryId },
    statUpdate,
    { upsert: true },
  );

  return { counted: true, duplicate: false, ...media, categoryName: category.name };
}

async function addCategory(guild, discordCategoryId) {
  await guild.channels.fetch();
  const category = guild.channels.cache.get(discordCategoryId) || await guild.channels.fetch(discordCategoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error('Geçerli bir Discord kategori ID gir.');
  const channelIds = [...guild.channels.cache.values()]
    .filter((channel) => channel.parentId === category.id && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement))
    .map((channel) => channel.id);
  await PinCategory.findOneAndUpdate(
    { guildId: guild.id, discordCategoryId: category.id },
    { $set: { name: category.name, channelIds, enabled: true } },
    { upsert: true, returnDocument: 'after' },
  );
  invalidatePinCache(guild.id);
  return { name: category.name, discordCategoryId: category.id, channelCount: channelIds.length };
}

async function removeCategory(guildId, discordCategoryId) {
  const removed = await PinCategory.findOneAndDelete({ guildId, discordCategoryId });
  invalidatePinCache(guildId);
  return removed;
}

async function setTrackedRole(guildId, roleId) {
  await Server.findOneAndUpdate(
    { guildId },
    { $set: { 'pinTracker.roleId': roleId, 'pinTracker.enabled': true } },
    { upsert: true },
  );
  invalidatePinCache(guildId);
}

async function getPinConfig(guildId) {
  const server = await Server.findOne({ guildId }).select('pinTracker prefix').lean();
  return {
    enabled: Boolean(server?.pinTracker?.enabled),
    roleId: server?.pinTracker?.roleId || null,
    ignoredChannelIds: Array.isArray(server?.pinTracker?.ignoredChannelIds) ? server.pinTracker.ignoredChannelIds : [],
    prefix: server?.prefix || '.',
  };
}

async function getStats(guildId, { userId, discordCategoryId, roleId, limit = 15 } = {}) {
  const query = { guildId };
  if (userId) query.userId = userId;
  if (discordCategoryId) query.discordCategoryId = discordCategoryId;
  if (roleId) {
    // roleId filter is applied by caller after fetching member ids; here we just return query base
  }
  const rows = await PinStat.find(query).sort({ totalCount: -1, updatedAt: -1 }).limit(limit).lean();
  return rows;
}

async function syncTrackedChannel(channel) {
  if (!channel?.guildId) return false;
  const isTrackable = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
  if (!isTrackable || !channel.parentId) return false;
  const result = await PinCategory.updateOne(
    { guildId: channel.guildId, discordCategoryId: channel.parentId, enabled: true },
    { $addToSet: { channelIds: channel.id } },
  );
  if (result.matchedCount || result.modifiedCount) {
    invalidatePinCache(channel.guildId);
    return true;
  }
  return false;
}

async function scanGuild(guild, { onProgress, throttleMs = 2500 } = {}) {
  if (!guild?.id) throw new Error('Guild gerekli.');
  const guildId = guild.id;
  const categories = await PinCategory.find({ guildId, enabled: true }).sort({ name: 1 }).lean();
  const stats = {
    categories: categories.length,
    channelsTotal: 0,
    channelsDone: 0,
    scanned: 0,
    added: 0,
    already: 0,
    skipped: 0,
    currentChannel: '',
    startedAt: Date.now(),
    finished: false,
  };
  if (!categories.length) { stats.finished = true; return stats; }

  // Build the channel list from the LIVE guild so new/moved channels are always included.
  const categoryByChannel = new Map();
  const categoryByDiscordId = new Map(categories.map((c) => [c.discordCategoryId, c]));
  try { await guild.channels.fetch(); } catch {}
  for (const channel of guild.channels.cache.values()) {
    if (!channel?.parentId) continue;
    const category = categoryByDiscordId.get(channel.parentId);
    if (!category) continue;
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) continue;
    categoryByChannel.set(channel.id, category);
    if (!(category.channelIds || []).includes(channel.id)) {
      category.channelIds = [...(category.channelIds || []), channel.id];
      await PinCategory.updateOne({ _id: category._id }, { $addToSet: { channelIds: channel.id } }).catch(() => {});
    }
  }
  // Keep DB-listed channels as a fallback.
  for (const category of categories) {
    for (const channelId of category.channelIds || []) {
      if (!categoryByChannel.has(channelId)) categoryByChannel.set(channelId, category);
    }
  }

  const targets = [];
  const seenChannels = new Set();
  const addTarget = (channel) => {
    if (!channel?.id || seenChannels.has(channel.id)) return;
    seenChannels.add(channel.id);
    targets.push(channel);
  };

  for (const channelId of categoryByChannel.keys()) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (channel) addTarget(channel);
  }

  // Include active + archived public threads that live under tracked channels.
  for (const channel of [...targets]) {
    for (const thread of guild.channels.cache.values()) {
      if (thread.parentId === channel.id && typeof thread.isThread === 'function' && thread.isThread()) addTarget(thread);
    }
    if (channel.threads?.fetchArchived) {
      try {
        const archived = await channel.threads.fetchArchived({ type: 'public', limit: 100 });
        for (const thread of archived.threads.values()) addTarget(thread);
      } catch {}
    }
  }

  stats.channelsTotal = targets.length;
  const seenMessages = new Set();
  let lastEmit = 0;

  const emit = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < throttleMs) return;
    lastEmit = now;
    try { await onProgress?.(stats); } catch {}
  };

  await emit(true);

  for (const channel of targets) {
    stats.currentChannel = channel.name || channel.id;
    let before = null;
    let batches = 0;
    while (true) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
      if (!batch || batch.size === 0) break;
      const msgs = [...batch.values()]; // newest -> oldest (never reverse in place)
      const oldestId = msgs[msgs.length - 1]?.id;
      for (const msg of msgs) {
        stats.scanned += 1;
        if (seenMessages.has(msg.id)) continue;
        seenMessages.add(msg.id);
        let result = null;
        try { result = await recordMessage(msg); } catch { result = null; }
        if (result?.counted) stats.added += 1;
        else if (result?.duplicate) stats.already += 1;
        else stats.skipped += 1;
      }
      batches += 1;
      if (batch.size < 100) break;
      if (!oldestId || oldestId === before) break;
      before = oldestId;
      if (batches % 2 === 0) await emit(false);
    }
    stats.channelsDone += 1;
    await emit(false);
  }

  stats.currentChannel = '';
  stats.finished = true;
  await emit(true);
  return stats;
}

function registerPinEvents(client) {
  client.on('channelCreate', (channel) => {
    syncTrackedChannel(channel).catch((error) => console.error('Pin channelCreate failed:', error.name));
  });
  client.on('channelUpdate', (oldChannel, newChannel) => {
    const moved = oldChannel?.parentId !== newChannel?.parentId;
    if (!moved) return;
    syncTrackedChannel(newChannel).catch((error) => console.error('Pin channelUpdate failed:', error.name));
  });
}

module.exports = {
  countMedia,
  invalidatePinCache,
  getTrackedChannels,
  recordMessage,
  addCategory,
  removeCategory,
  setTrackedRole,
  getPinConfig,
  getStats,
  syncTrackedChannel,
  scanGuild,
  registerPinEvents,
};
