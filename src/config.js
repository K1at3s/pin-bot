/*
 * Minimal config for standalone pin bot.
 * DISCORD_TOKEN ve MONGODB_URI'yi .env dosyasından yükler.
 */
const { loadEnv } = require('./scripts/backup-code.cjs'); // env loader helper

// .env dosyasını yükle (process.env already set by baslat.bat veya manuel)
// Eğer doğrudan node . çalıştırıyorsan .env dosyasının yanında olmalı

function getEnv(key, defaultValue) {
  return process.env[key] || defaultValue;
}

// DISCORD_TOKEN ZORUNLU
const token = getEnv('DISCORD_TOKEN');
if (!token) {
  console.error('❌ DISCORD_TOKEN environment variable not set!');
  process.exit(1);
}

module.exports = {
  token,
  // Prefix: . (değiştirilebilir), opsiyonel olarak .env'den okutulabilir
  prefix: getEnv('PREFIX', '.'),
  // Opsiyonel: staff rol ID, ignored channel IDs vs.
  pinTracker: {
    roleId: getEnv('PIN_TRACKER_ROLE_ID', ''),
    ignoredChannelIds: getEnv('IGNORED_CHANNEL_IDS', '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  },
  // MongoDB
  mongodbUri: getEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
  mongodbDatabase: getEnv('MONGODB_DATABASE', 'ticket_bot'),
};