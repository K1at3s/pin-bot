/*
 * Standalone Pin Bot - Only pin tracking, no ticket system
 * Discord.js 14.x + MongoDB
 * Bot prefix: . (değiştirilebilir)
 */

import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { config } from './config.js';
import { connectDatabase, mongoClient } from './database.js';
import { registerPinEvents } from './handlers/pinTracker.js';

// Intents: Guills + Messages + MessageContent (pin tracking için messageContent gerekli)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  allowedMentions: { parse: [] },
});

// Veritabanı bağlantısı
await connectDatabase();

// Pin events register (scanGuild, recordMessage, category sync vb.)
registerPinEvents(client);

// Bot hazır olduğunda: status = idle, aktivite = GIF STORY 💙
client.once(Events.ClientReady, (readyClient) => {
  console.log(`[PIN BOT] Ready: ${readyClient.user.tag}`);

  // Botu idle status + "GIF STORY 💙" olarak ayarla
  readyClient.user.setPresence({
    activities: [{ name: 'Pin Bot', type: ActivityType.Watching }],
    status: 'idle',
  });

  // Başlangıçta pin kategorilerini tanı
  const guild = readyClient.guilds.cache.first();
  if (guild) {
    console.log(`[PIN BOT] Guild: ${guild.name} (${guild.id})`);
  }
});

// Mesaj oluşturma eventi: pin tracking (spam koruması + link filter + recordMessage)
client.on(Events.MessageCreate, async (message) => {
  // Bot ve webhook'leri atla
  if (message.author?.bot || message.webhookId) return;

  // Prefix komut dispatcher (eğer .pin komutu geldiyse)
  const prefix = config?.prefix || '.';
  if (message.content.startsWith(prefix)) {
    const raw = message.content.slice(prefix.length).trim();
    if (!raw) return;

    const [name, ...args] = raw.split(/\s+/).map((a) => a.toLowerCase());
    const command = name;

    // .pin komutları
    if (command === 'pin') {
      const subcommand = args[0];
      if (!subcommand) {
        await message.reply({
          content: 'Kullanım: `.pin add <id>` | `.pin remove <id>` | `.pin stats` | `.pin scan` | `.pin backfill` | `.pin logs <id>` | `.pin ignore add/remove <id>` | `.pin role <id>` | `.pin categories`',
          allowedMentions: { parse: [] },
        });
        return;
      }

      // Subcommand'ları handle et (pin.js'den import yapabilirsin, burada basit mapping)
      try {
        switch (subcommand) {
          case 'add': {
            const categoryId = args[1];
            if (!categoryId) {
              return await message.reply('Lütfen bir kategori ID girin: `.pin add <kategoriID>`');
            }
            // TODO: addCategory logic - PinCategory.find/create + channelIds ekle
            await message.reply(`Kategori eklenmesi için: PinCategory koleksiyonuna ${categoryId} ekle`);
            break;
          }
          case 'remove': {
            const categoryId = args[1];
            if (!categoryId) {
              return await message.reply('Lütfen bir kategori ID girin: `.pin remove <id>`');
            }
            // TODO: removeCategory logic
            await message.reply('Kategori kaldırma placeholder');
            break;
          }
          case 'stats': {
            // TODO: PinStat toplu sorgu veya genel pin sayısı
            await message.reply('Pin stats placeholder - toplama bak diag-pins.cjs');
            break;
          }
          case 'scan': {
            // TODO: scanGuild logic (canlı ilerleme ile)
            await message.reply('Scan placeholder - diag-pins.cjs veya src handlers bak');
            break;
          }
          case 'backfill': {
            // TODO: backfill / scan idempotent
            await message.reply('Backfill placeholder - DB zaten 545 log var, tekrar scan protected');
            break;
          }
          case 'logs': {
            const userId = args[1];
            if (!userId) {
              return await message.reply('Kullanıcı ID gerekli: `.pin logs <kullanıcıID>`');
            }
            // TODO: PinLog find { userId, guildId } - last 1000 entries
            await message.reply(`Logs placeholder: ${userId} için PinLog sorgusu`);
            break;
          }
          case 'ignore': {
            const action = args[1]; // add/remove
            const channelId = args[2];
            if (!action || !channelId) {
              return await message.reply('Kullanım: `.pin ignore add <id>` | `.pin ignore remove <id>`');
            }
            // TODO: Server schema ignoredChannelIds güncelle
            await message.reply('Ignore placeholder - Server schema ekle');
            break;
          }
          case 'role': {
            const roleId = args[1];
            if (!roleId) {
              return await message.reply('Rol ID gerekli: `.pin role <id>`');
            }
            // TODO: Server schema pinTracker.roleId güncelle
            await message.reply('Role placeholder - Server pinTracker.roleId set');
            break;
          }
          case 'categories': {
            // TODO: PinCategory.find { guildId } döndür
            await message.reply('Categories placeholder - PinCategory find guildId');
            break;
          }
          default:
            await message.reply(`Bilinmeyen subcommand: .pin ${command} ${subcommand}. Kullanım: add/remove/stats/scan/backfill/logs/ignore/role/categories`);
        }
      } catch (error) {
        console.error('[PIN BOT] Command error:', error);
        await message.reply({ content: 'Komut çalışırken hata oluştu.', allowedMentions: { parse: [] } });
      }
      return;
    }
  }

  // Pin tracking: her mesaja recordMessage uygula (atık/ek sayımı)
  try {
    await recordMessage(message);
  } catch (error) {
    console.error('[PIN BOT] recordMessage error:', error);
  }
});

// Hesaplama hatalarını yakala
client.on(Events.Error, (error) => {
  console.error('[PIN BOT] Discord error:', error.message);
});

async function main() {
  try {
    await client.login(config.token);
    console.log('[PIN BOT] Logged in, awaiting events...');
  } catch (error) {
    console.error('[PIN BOT] Login failed:', error.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[PIN BOT] Fatal error:', e);
  process.exit(1);
});

// Helper: recordMessage (pinTracker'dan alınan funktionun minimal kopya)
async function recordMessage(message) {
  // pinTracker.js'den copied minimal versiyon
  const { ChannelType } = require('discord.js');
  const PinLog = require('./schemas/PinLog.js');

  if (!message?.guildId || !message?.id || message.author?.bot || message.webhookId) return;

  // Media sayacı (attachment sayısı + photo/gif breakdown)
  let photo = 0;
  let gif = 0;
  let files = 0;

  for (const att of message.attachments.values()) {
    files += 1;
    const ct = String(att.contentType || '').toLowerCase();
    const name = String(att.name || '').toLowerCase();
    if (ct.startsWith('image/gif') || /\.gif($|\?)/i.test(name)) gif += 1;
    else if (ct.startsWith('image/') || /\.(png|jpe?g|jfif|webp|bmp|tiff?|avif|heic|heif|apng|ico)($|\?)/i.test(name)) photo += 1;
  }

  // En az bir dosya yoksa atla (link embed'i sayılmaz)
  if (!files) return;

  // Ignored channel kontrol (opsiyonel: config'den okumak daha iyidir)
  // Simplest: herhangi bir tracked category'sa say, değilse atla
  // Bu botda kategori tanımı olmadığı için her medya mesajını kaydedelim (opsiyonel filtering)

  // PinLog kaydet (unique: guildId + messageId)
  try {
    const existing = await PinLog.findOne({ guildId: message.guildId, messageId: message.id });
    if (existing) {
      // Already exists - increment fileCount if needed
      if (existing.fileCount < files) {
        await PinLog.updateOne(
          { guildId: message.guildId, messageId: message.id },
          { $set: { fileCount: files, photoCount: photo, gifCount: gif, totalCount: 1 } }
        );
      }
    } else {
      await PinLog.create({
        guildId: message.guildId,
        messageId: message.id,
        userId: message.author?.id || null,
        displayName: message.author?.username || null,
        channelId: message.channelId,
        totalCount: 1,
        fileCount: files,
        photoCount: photo,
        gifCount: gif,
      });
    }
  } catch (dbError) {
    console.error('[PIN BOT] DB error in recordMessage:', dbError.message);
  }
}

export { recordMessage, main };