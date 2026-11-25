# Pin Bot - Discord Media Pin Tracking Bot

## Overview

Pin Bot is a Discord bot that tracks pinned messages and file attachments within configured Discord categories. It counts:

- **Pin count**: Number of messages containing at least one uploaded attachment (matches Discord search behavior)
- **File count**: Total number of actual uploaded attachments
- **Photo/GIF breakdown**: Per-attachment media type statistics

### Key Features

- **Category-based tracking**: Pin tracking is managed by Discord category ID using `.pin add <id>` and `.pin remove <id>`
- **Link blocking**: Blocks obfuscated URLs (unicode, bidi, zero-width, punycode/homoglyph, IP/IPv6, invite variants)
- **Spam protection**: 5s window/6 messages flood limit; 5s duplicate window/4 duplicates
- **Staff/exempt roles**: Custom roles can be exempted from all counting
- **Ignored channels**: Specific channels (and their threads) can be excluded from tracking
- **Thread support**: Active + archived public threads under tracked categories are included
- **New channel auto-detection**: Channels added to tracked categories are automatically included
- **Progress tracking**: `.pin scan`/`.pin backfill` show live progress (scanned, added, already, skipped, current channel, elapsed)
- **Stats & logs**: `.pin stats` shows server-wide pin/file/photo/gif totals; `.pin logs <id>` shows user's pin history

### Counting Rule

- **Pin (message count)**: 1 per message containing at least one uploaded attachment
  - Matches Discord search behavior
  - Link previews/embeds (Tenor, GIPHY, etc.) are NOT counted
  - Only real `message.attachments` count
- **File (attachment count)**: Number of actual uploaded attachments
  - A 10-file message = 1 pin + 10 files
- **Photo/GIF**: Breakdown of attachment types

### Example Output

```
• Toplam Pin (mesaj): 545
• Toplam Dosya: 553
• Fotoğraf: 544
• GIF: 9

• flenia — 123 pin • 131 dosya (📷 131 | 🎞️ 0)
```

## File Structure

```
pin bot/
├─ .env.example           # Ortam değişkenleri örnekleri
├─ package.json           # Bağımlılıklar (discord.js + mongoose)
├─ README.md              # Bu dosya
│
├─ src/
│  ├─ commands/
│  │   └─ Pin/
│  │        └─ pin.js              # All .pin subcommands (add, remove, categories, role, stats, logs, ignore, scan, backfill)
│  ├─ handlers/
│  │   └─ pinTracker.js            # scanGuild, countMedia, recordMedia, category/channel sync, config cache
│  ├─ schemas/
│  │   ├─ PinCategory.js           # Tracked categories and channel ID lists
│  │   ├─ PinLog.js                # Per-message log (unique guildId+messageId, has fileCount)
│  │   └─ PinStat.js               # Aggregated per-user/category stats (has fileCount, photoCount, gifCount)
│  └─ index.js                  # Ana bot dosyası - Events + Commands + Pin Tracking
│
└─ (scripts klasörü yok - kod yedekleri ayrı komutla alınır)
```

## Installation

1. Repo'yu klonla: `git clone <repo-url>`
2. Bağımlılıkları yükle: `npm install`
3. `.env.example` kopyala ve doldur: `.env` dosyası oluştur
   - `DISCORD_TOKEN` ve `MONGODB_URI` zorunludur
4. Botu başlat: `node .env && node src/index.js`
   - Veya: `baslat.bat` (eğer varsa)
5. Kategorileri tanıt: `.pin add <kategoriID>`

## Usage Commands (Kullanım)

| Komut | Açıklama |
|------|----------|
| `.pin add <id>` | Kategori ekle |
| `.pin remove <id>` | Kategori kaldır |
| `.pin categories` | Takip edilen kategorileri listele |
| `.pin role <id>` | Staff rolü ayarla |
| `.pin stats` | Sunucu istatistikleri |
| `.pin stats <kullanıcıID>` | Kullanıcı istatistikleri |
| `.pin logs <kullanıcıID>` | Kullanıcının pin geçmişi |
| `.pin ignore add/remove <id>` | Kanalı ignore listeye ekle/çıkar |
| `.pin scan` | Tüm sunucuyu tara (canlı ilerleme) |
| `.pin backfill` | Eski mesajları geri yükle (idempotent) |

## English

### Overview

Pin Bot is a Discord bot that tracks pinned messages and file attachments within configured Discord categories. It counts:

- **Pin count**: Number of messages containing at least one uploaded attachment (matches Discord search behavior)
- **File count**: Total number of actual uploaded attachments
- **Photo/GIF breakdown**: Per-attachment media type statistics

### Key Features

- **Category-based tracking**: Pin tracking is managed by Discord category ID using `.pin add <id>` and `.pin remove <id>`
- **Link blocking**: Blocks obfuscated URLs (unicode, bidi, zero-width, punycode/homoglyph, IP/IPv6, invite variants)
- **Spam protection**: 5s window/6 messages flood limit; 5s duplicate window/4 duplicates
- **Staff/exempt roles**: Custom roles can be exempted from all counting
- **Ignored channels**: Specific channels (and their threads) can be excluded from tracking
- **Thread support**: Active + archived public threads under tracked categories are included
- **New channel auto-detection**: Channels added to tracked categories are automatically included
- **Progress tracking**: `.pin scan`/`.pin backfill` show live progress (scanned, added, already, skipped, current channel, elapsed)
- **Stats & logs**: `.pin stats` shows server-wide pin/file/photo/gif totals; `.pin logs <id>` shows user's pin history

### Counting Rule

- **Pin (message count)**: 1 per message containing at least one uploaded attachment
  - Matches Discord search behavior
  - Link previews/embeds (Tenor, GIPHY, etc.) are NOT counted
  - Only real `message.attachments` count
- **File (attachment count)**: Number of actual uploaded attachments
  - A 10-file message = 1 pin + 10 files
- **Photo/GIF**: Breakdown of attachment types

### Example Output

```
• Total Pins: 545
• Total Files: 553
• Photos: 544
• GIFs: 9

• flenia — 123 pin • 131 files (📷 131 | 🎞️ 0)
```

## File Structure (English)

```
pin bot/
├─ .env.example           # Environment variable examples
├─ package.json           # Dependencies (discord.js + mongoose)
├─ README.md              # This file
│
├─ src/
│  ├─ commands/
│  │   └─ Pin/
│  │        └─ pin.js              # All .pin subcommands (add, remove, categories, role, stats, logs, ignore, scan, backfill)
│  ├─ handlers/
│  │   └─ pinTracker.js            # scanGuild, countMedia, recordMedia, category/channel sync, config cache
│  ├─ schemas/
│  │   ├─ PinCategory.js           # Tracked categories and channel ID lists
│  │   ├─ PinLog.js                # Per-message log (unique guildId+messageId, has fileCount)
│  │   └─ PinStat.js               # Aggregated per-user/category stats (has fileCount, photoCount, gifCount)
│  └─ index.js                  # Main bot file - Events + Commands + Pin Tracking
│
└─ (scripts folder not included - backups taken via separate commands)
```

## Installation (English)

1. Clone the repo: `git clone <repo-url>`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in
   - `DISCORD_TOKEN` and `MONGODB_URI` are required
4. Start the bot: `node .env && node src/index.js`
   - Or: `baslat.bat` (if available)
5. Add categories: `.pin add <categoryId>`

## Usage Commands (English)

| Command | Description |
|---------|-------------|
| `.pin add <id>` | Add a category |
| `.pin remove <id>` | Remove a category |
| `.pin categories` | List tracked categories |
| `.pin role <id>` | Set staff role |
| `.pin stats` | Server statistics |
| `.pin stats <userId>` | User statistics |
| `.pin logs <userId>` | User's pin history |
| `.pin ignore add/remove <id>` | Add/remove channel from ignore list |
| `.pin scan` | Scan entire server (live progress) |
| `.pin backfill` | Restore old messages (idempotent) |

## .env.example

Create a `.env` file in the project root with the following variables:

```env
# Discord Bot Token (REQUIRED)
DISCORD_TOKEN=your_discord_bot_token_here

# MongoDB Connection URI (REQUIRED)
# Local: mongodb://127.0.0.1:27017
# Atlas: mongodb+srv://username:password@cluster0.mongodb.net
MONGODB_URI=mongodb://127.0.0.1:27017

# Database name (OPTIONAL, default: ticket_bot)
MONGODB_DATABASE=ticket_bot

# Bot command prefix (OPTIONAL, default: .)
PREFIX=.

# Staff role ID for exemptions (OPTIONAL)
PIN_TRACKER_ROLE_ID=

# Ignored channel IDs (OPTIONAL, comma-separated)
IGNORED_CHANNEL_IDS=

# Whether pin tracking is enabled (OPTIONAL, default: true)
PIN_TRACKER_ENABLED=true
```

## Important Notes

- **Never share your bot token publicly** - Keep `.env` out of version control
- The bot requires `intents: [Guilds, GuildMessages, MessageContent]` in Discord Developer Portal
- Pin tracking only works in categories added via `.pin add`
- Use `.pin backfill` to scan existing message history; it's idempotent (won't double-count)
- Database backups are automatically created when using `backup-code.cjs` and `backup-db.cjs`
- Bot status: **idle** • **Pin Bot** (Discord'da 🟡 Pin Bot olarak görünür)