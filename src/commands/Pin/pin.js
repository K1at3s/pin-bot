const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const PinCategory = require('../../schemas/PinCategory');
const PinLog = require('../../schemas/PinLog');
const PinStat = require('../../schemas/PinStat');
const Server = require('../../schemas/Server');
const { addCategory, removeCategory, setTrackedRole, getPinConfig, scanGuild, invalidatePinCache } = require('../../handlers/pinTracker');
const { isManager } = require('../../handlers/security');

const P = require('discord.js').PermissionsBitField.Flags;

function fmt(n) { return Number(n || 0).toLocaleString('tr-TR'); }

async function ensureManager(target, reply) {
  if (await isManager(target)) return true;
  const payload = { content: 'Bu komutu kullanmak için **Kanalları Yönet** yetkisi gerekli.', allowedMentions: { parse: [] } };
  if (target.deferred || target.replied) await target.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
  else await reply({ ...payload, flags: MessageFlags.Ephemeral });
  return false;
}

async function getCategoryChoices(guildId) {
  return PinCategory.find({ guildId, enabled: true }).sort({ name: 1 }).lean();
}

async function resolveCategory(guildId, input) {
  if (!input) return null;
  const categories = await getCategoryChoices(guildId);
  const value = String(input).toLowerCase();
  return categories.find((c) => c.discordCategoryId === input || c.name.toLowerCase() === value || c.name.toLowerCase().includes(value)) || null;
}

async function handleAdd(target, id, reply) {
  const isInteraction = typeof target.deferReply === 'function';
  if (isInteraction) await target.deferReply().catch(() => {});
  if (!await isManager(target)) {
    const payload = { content: 'Bu komutu kullanmak için **Kanalları Yönet** yetkisi gerekli.', allowedMentions: { parse: [] } };
    if (isInteraction) return target.editReply(payload).catch(() => {});
    return reply(payload);
  }
  try {
    const result = await addCategory(target.guild, id);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Kategori Eklendi')
      .setDescription(`**${result.name}** kategorisi pin takibine eklendi.\nKanal sayısı: **${result.channelCount}**`)
      .setTimestamp();
    if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
    else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Hata')
      .setDescription(error.message);
    if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
    else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

async function handleRemove(target, id, reply) {
  const isInteraction = typeof target.deferReply === 'function';
  if (isInteraction) await target.deferReply().catch(() => {});
  if (!await isManager(target)) {
    const payload = { content: 'Bu komutu kullanmak için **Kanalları Yönet** yetkisi gerekli.', allowedMentions: { parse: [] } };
    if (isInteraction) return target.editReply(payload).catch(() => {});
    return reply(payload);
  }
  try {
    const removed = await removeCategory(target.guildId, id);
    if (!removed) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Hata')
        .setDescription('Kategori bulunamadı.');
      if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
      else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Kategori Kaldırıldı')
      .setDescription(`**${removed.name}** kategorisi pin takibinden kaldırıldı.`);
    if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
    else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Hata')
      .setDescription(error.message);
    if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
    else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

async function handleCategories(target, reply) {
  if (!await isManager(target, reply)) return;
  const categories = await getCategoryChoices(target.guildId);
  const lines = categories.map((c) => `• **${c.name}** — ${c.channelIds?.length || 0} kanal (<#${c.discordCategoryId}>)`);
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Takip Edilen Pin Kategorileri')
    .setDescription(lines.join('\n') || 'Kategori yok. `.pin scan` ile tara.')
    .setTimestamp();
  if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
  else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleRole(target, roleId, reply) {
  const isInteraction = typeof target.deferReply === 'function';
  if (isInteraction) await target.deferReply().catch(() => {});
  if (!await isManager(target, reply)) return;
  const role = roleId ? target.guild.roles.cache.get(roleId) : null;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Öncelikli Rol')
    .setDescription(roleId ? `<@&${roleId}>(${role?.name || roleId})` : 'Rol ayarlanmamış.')
    .setTimestamp();
  if (isInteraction) await target.editReply({ embeds: [embed] }).catch(() => {});
  else await reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleLogs(target, userId, reply) {
  if (!await ensureManager(target, reply)) return;
  if (!userId) return reply({ content: 'Kullanım: `.pin logs @kullanıcı` veya `.pin logs <id>`', allowedMentions: { parse: [] } });

  const logs = await PinLog.find({ guildId: target.guildId, userId }).sort({ createdAt: -1 }).lean();
  const member = target.guild.members.cache.get(userId)
    || await target.guild.members.fetch(userId).catch(() => null);

  const displayName = member?.displayName || (logs[0]?.displayName || logs[0]?.username || userId);

  const catMap = new Map();
  for (const l of logs) {
    const key = l.discordCategoryId;
    if (!catMap.has(key)) {
      catMap.set(key, { photoCount: 0, gifCount: 0, fileCount: 0, totalCount: 0, entryCount: 0, categoryName: l.categoryName });
    }
    const cat = catMap.get(key);
    cat.photoCount += l.photoCount || 0;
    cat.gifCount += l.gifCount || 0;
    cat.fileCount += (typeof l.fileCount === 'number' ? l.fileCount : (l.photoCount || 0) + (l.gifCount || 0));
    cat.totalCount += l.totalCount || 0;
    cat.entryCount += 1;
    if (!cat.categoryName) cat.categoryName = l.categoryName;
  }

  const catLines = [...catMap.values()]
    .map((c) => `• **${c.categoryName || 'Bilinmeyen'}** — **${fmt(c.totalCount)}** pin • **${fmt(c.fileCount)}** dosya (📷 ${fmt(c.photoCount)} | 🎞️ ${fmt(c.gifCount)})`)
    .join('\n') || 'Kayıt bulunamadı.';

  const totalPhoto = [...catMap.values()].reduce((a, c) => a + (c.photoCount || 0), 0);
  const totalGif = [...catMap.values()].reduce((a, c) => a + (c.gifCount || 0), 0);
  const totalFile = [...catMap.values()].reduce((a, c) => a + (c.fileCount || 0), 0);
  const totalTotal = [...catMap.values()].reduce((a, c) => a + (c.totalCount || 0), 0);

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`Pin Logları: ${displayName}`)
    .setDescription(catLines)
    .addFields(
      { name: 'Toplam Pin (mesaj)', value: fmt(totalTotal), inline: true },
      { name: 'Toplam Dosya', value: fmt(totalFile), inline: true },
      { name: 'Fotoğraf', value: fmt(totalPhoto), inline: true },
      { name: 'GIF', value: fmt(totalGif), inline: true },
      { name: 'Kullanıcı', value: `${displayName} (<@${userId}>)\nID: \`${userId}\``, inline: false }
    )
    .setTimestamp();
  await reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleIgnore(target, { channelId, remove, list }, reply) {
  if (!await ensureManager(target, reply)) return;
  const server = await Server.findOne({ guildId: target.guildId }).select('pinTracker.ignoredChannelIds').lean();
  const current = Array.isArray(server?.pinTracker?.ignoredChannelIds) ? server.pinTracker.ignoredChannelIds : [];

  if (list || (!channelId && !remove)) {
    const lines = current.length ? current.map((id) => `• <#${id}> (\`${id}\`)`).join('\n') : 'Yok';
    return reply({ content: `**Pin sayımında yok sayılan kanallar:**\n${lines}`, allowedMentions: { parse: [] } });
  }

  if (!channelId) return reply({ content: 'Kanal ID veya kanal belirt.', allowedMentions: { parse: [] } });

  if (remove) {
    await Server.findOneAndUpdate({ guildId: target.guildId }, { $pull: { 'pinTracker.ignoredChannelIds': channelId } }, { upsert: true });
    invalidatePinCache(target.guildId);
    return reply({ content: `<#${channelId}> (\`${channelId}\`) artık pin sayımına dahil.`, allowedMentions: { parse: [] } });
  }

  await Server.findOneAndUpdate({ guildId: target.guildId }, { $addToSet: { 'pinTracker.ignoredChannelIds': channelId } }, { upsert: true });
  invalidatePinCache(target.guildId);
  return reply({ content: `<#${channelId}> (\`${channelId}\`) pin sayımında yok sayılacak. Bu kanala atılan medyalar sayılmaz.`, allowedMentions: { parse: [] } });
}

async function handleStats(target, { userId, roleId }, reply) {
  if (!await ensureManager(target, reply)) return;
  const query = { guildId: target.guildId };
  if (userId) query.userId = userId;

  let rows = await PinStat.find(query).sort({ totalCount: -1, updatedAt: -1 }).limit(10000).lean();

  if (roleId) {
    // Role filtering simplified
  }

  const aggregated = new Map();
  for (const row of rows) {
    const prev = aggregated.get(row.userId) || { userId: row.userId, username: row.username, displayName: row.displayName, hasTrackedRole: row.hasTrackedRole, photoCount: 0, gifCount: 0, fileCount: 0, totalCount: 0 };
    prev.photoCount += row.photoCount || 0;
    prev.gifCount += row.gifCount || 0;
    prev.fileCount += (typeof row.fileCount === 'number' ? row.fileCount : (row.photoCount || 0) + (row.gifCount || 0));
    prev.totalCount += row.totalCount || 0;
    if (!prev.username && row.username) prev.username = row.username;
    if (!prev.displayName && row.displayName) prev.displayName = row.displayName;
    if (row.hasTrackedRole) prev.hasTrackedRole = true;
    aggregated.set(row.userId, prev);
  }
  const top = [...aggregated.values()].sort((a, b) => (Number(b.hasTrackedRole) - Number(a.hasTrackedRole)) || (b.totalCount - a.totalCount)).slice(0, 15);

  const lines = top.map((r) => `• **${r.displayName || r.username}** — **${fmt(r.totalCount)}** pin • **${fmt(r.fileCount)}** dosya (📷 ${fmt(r.photoCount)} | 🎞️ ${fmt(r.gifCount)})`).join('\n') || 'Kayıt bulunamadı.';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Pin İstatistikleri')
    .setDescription(lines)
    .addFields(
      { name: 'Toplam Pin (mesaj)', value: fmt(top.reduce((a, r) => a + (r.totalCount || 0), 0)), inline: true },
      { name: 'Toplam Dosya', value: fmt(top.reduce((a, r) => a + (r.fileCount || 0), 0)), inline: true },
      { name: 'Fotoğraf', value: fmt(top.reduce((a, r) => a + (r.photoCount || 0), 0)), inline: true },
      { name: 'GIF', value: fmt(top.reduce((a, r) => a + (r.gifCount || 0), 0)), inline: true },
    )
    .setTimestamp();
  await reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function handleScan(target, reply) {
  const isInteraction = typeof target.deferReply === 'function';
  if (isInteraction) await target.deferReply().catch(() => {});
  if (!await isManager(target)) {
    const payload = { content: 'Bu komutu kullanmak için **Kanalları Yönet** yetkisi gerekli.', allowedMentions: { parse: [] } };
    if (isInteraction) return target.editReply(payload).catch(() => {});
    return reply(payload);
  }

  const guild = target.guild;
  const guildId = target.guildId || guild?.id;
  const categories = await getCategoryChoices(guildId);
  if (!categories.length) {
    const payload = { content: 'Takip edilen kategori yok. Önce `.pin add <kategoriID>` ile kategori ekle.', allowedMentions: { parse: [] } };
    if (isInteraction) return target.editReply(payload).catch(() => {});
    return reply(payload);
  }

  let statusMessage = null;
  const render = (stats, done = false) => {
    const state = done ? '✅ Tarama tamamlandı' : '🔄 Tarama devam ediyor';
    const current = done || !stats.currentChannel ? '' : `\nŞu an: **#${stats.currentChannel}**`;
    const seconds = Math.floor((Date.now() - stats.startedAt) / 1000);
    return {
      content: `${state}\nKategoriler: **${fmt(stats.categories)}** | Kanallar: **${fmt(stats.channelsDone)}/${fmt(stats.channelsTotal)}**${current}\nTaranan mesaj: **${fmt(stats.scanned)}** | Eklenen: **${fmt(stats.added)}** | Zaten kayıtlı: **${fmt(stats.already)}** | Medyasız/atlanan: **${fmt(stats.skipped)}**\nSüre: **${fmt(seconds)}sn**`,
      allowedMentions: { parse: [] },
    };
  };

  const onProgress = async (stats) => {
    const payload = render(stats, false);
    try {
      if (isInteraction) await target.editReply(payload);
      else if (statusMessage) await statusMessage.edit(payload);
      else statusMessage = await reply(payload);
    } catch {}
  };

  try {
    const stats = await scanGuild(guild, { onProgress });
    const finalPayload = render(stats, true);
    if (isInteraction) await target.editReply(finalPayload);
    else if (statusMessage) await statusMessage.edit(finalPayload);
    else await reply(finalPayload);
  } catch (error) {
    const payload = { content: `Tarama başarısız: ${error?.message || error?.name || 'Bilinmeyen hata'}`, allowedMentions: { parse: [] } };
    if (isInteraction) await target.editReply(payload).catch(() => {});
    else if (statusMessage) await statusMessage.edit(payload).catch(() => {});
    else await reply(payload);
  }
}

const handleBackfill = handleScan;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pin')
    .setDescription('Pin istatistiklerini ve kategori takibini yönetir.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(P.ManageChannels)
    .addSubcommand((s) => s.setName('add').setDescription('Kategori ekle').addStringOption((o) => o.setName('id').setDescription('Kategori ID').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Kategori kaldir').addStringOption((o) => o.setName('id').setDescription('Kategori ID').setRequired(true)))
    .addSubcommand((s) => s.setName('categories').setDescription('Kategoriler'))
    .addSubcommand((s) => s.setName('role').setDescription('Rol').addRoleOption((o) => o.setName('role').setDescription('Rol').setRequired(false)))
    .addSubcommand((s) => s.setName('stats').setDescription('Istatik').addUserOption((o) => o.setName('user').setDescription('Kullanici').setRequired(false)).addRoleOption((o) => o.setName('role').setDescription('Rol').setRequired(false)))
    .addSubcommand((s) => s.setName('logs').setDescription('Loglar').addUserOption((o) => o.setName('user').setDescription('Kullanici').setRequired(true)))
    .addSubcommand((s) => s.setName('ignore').setDescription('Ikanal').addChannelOption((o) => o.setName('channel').setDescription('Kanal').setRequired(false)).addBooleanOption((o) => o.setName('remove').setDescription('Kaldir').setRequired(false)))
    .addSubcommand((s) => s.setName('scan').setDescription('Tara'))
    .addSubcommand((s) => s.setName('backfill').setDescription('Backfill')),
  permissions: P.ManageChannels,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'backfill' && sub !== 'scan') await interaction.deferReply().catch(() => {});
    const reply = (payload) => (interaction.deferred || interaction.replied ? interaction.editReply(payload) : interaction.reply(payload));
    if (sub === 'add') return handleAdd(interaction, interaction.options.getString('id'), reply);
    if (sub === 'remove') return handleRemove(interaction, interaction.options.getString('id'), reply);
    if (sub === 'categories') return handleCategories(interaction, reply);
    if (sub === 'role') return handleRole(interaction, interaction.options.getRole('role')?.id, reply);
    if (sub === 'logs') return handleLogs(interaction, interaction.options.getUser('user')?.id, reply);
    if (sub === 'ignore') return handleIgnore(interaction, {
      channelId: interaction.options.getChannel('channel')?.id,
      remove: interaction.options.getBoolean('remove'),
      list: interaction.options.getBoolean('list'),
    }, reply);
    if (sub === 'scan' || sub === 'backfill') return handleBackfill(interaction, reply);
    if (sub === 'stats') return handleStats(interaction, {
      userId: interaction.options.getUser('user')?.id,
      roleId: interaction.options.getRole('role')?.id,
    }, reply);
  },

  async executePrefix(message, args) {
    const sub = String(args[0] || 'stats').toLowerCase();
    const reply = (payload) => message.reply({ allowedMentions: { parse: [] }, ...payload });
    if (sub === 'add' || sub === 'ekle') return handleAdd(message, args[1], reply);
    if (sub === 'remove' || sub === 'sil' || sub === 'kaldir' || sub === 'kaldır') return handleRemove(message, args[1], reply);
    if (sub === 'categories' || sub === 'kategoriler' || sub === 'kategori') return handleCategories(message, reply);
    if (sub === 'role' || sub === 'rol') {
      const role = message.mentions.roles.first() || (args[1] ? message.guild.roles.cache.get(args[1]) : null) || (args[1] && /^\d{15,20}$/.test(args[1]) ? await message.guild.roles.fetch(args[1]).catch(() => null) : null);
      return handleRole(message, role?.id || null, reply);
    }
    if (sub === 'ignore' || sub === 'yoksay') {
      const list = ['list', 'liste'].includes(String(args[1] || '').toLowerCase());
      const remove = ['remove', 'sil', 'kaldir', 'kaldır'].includes(String(args[1] || '').toLowerCase());
      const rawId = args.find((a, i) => i > 0 && /^<#\d+>$/.test(a))?.replace(/[<#>]/g, '')
        || args.find((a, i) => i > 0 && /^\d{15,20}$/.test(a));
      return handleIgnore(message, { channelId: rawId || null, remove, list }, reply);
    }
    if (sub === 'scan' || sub === 'tara' || sub === 'backfill' || sub === 'tara-gecmis') return handleScan(message, reply);
    if (sub === 'logs' || sub === 'log') {
      const mention = message.mentions.users.first();
      const rawId = mention?.id || args.slice(1).find((a) => /^\d{15,20}$/.test(a)) || null;
      return handleLogs(message, rawId, reply);
    }

    const isStats = ['stats', 'stat', 'top', 'sıralama'].includes(sub);
    const tokens = isStats ? args.slice(1) : args;
    const mentionedUser = message.mentions.users.first();
    const mentionedRole = message.mentions.roles.first();
    let userId = mentionedUser?.id || null;
    let roleId = mentionedRole?.id || null;

    for (const token of tokens) {
      if (/^<@!?\d+>$/.test(token) || /^<@&\d+>$/.test(token)) continue;
      if (/^\d{15,20}$/.test(token)) {
        if (userId && token === userId) continue;
        if (roleId && token === roleId) continue;
        const role = message.guild.roles.cache.get(token) || await message.guild.roles.fetch(token).catch(() => null);
        if (role) { roleId = role.id; continue; }
        if (!userId) { userId = token; continue; }
      }
    }
    return handleStats(message, { userId, roleId }, reply);
  },
};