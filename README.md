# Pin Bot

Discord sunucularındaki yapılandırılmış kategorilerde medya eklerini takip eden bot. / Discord bot that tracks media attachments in configured categories.

## Türkçe

### Genel Bakış

Pin Bot, seçili Discord kategorilerindeki ekli medya mesajlarını takip eder. MongoDB'de pin, dosya, fotoğraf ve GIF istatistiklerini tutar.

- **Pin sayısı**: En az bir ek içeren mesaj sayısı
- **Dosya sayısı**: Toplam ek sayısı
- **Fotoğraf/GIF**: Ek türü kırılımı

### Özellikler

- **Kategori bazlı takip**: `.pin add <id>` / `.pin remove <id>` ile kategori yönetimi
- **Yoksayılan kanallar**: Belirli kanallar takip dışı bırakılabilir
- **Tarama & Backfill**: `.pin scan` ve `.pin backfill` ile mevcut mesajlar taranabilir
- **İstatistikler & loglar**: `.pin stats` ve `.pin logs <id>`
- **Rol ayarı**: `.pin role <id>` ile staff rolü ayarlanabilir

### Sayım Kuralı

- **Pin**: En az bir gerçek ek (`message.attachments`) içeren mesaj = 1 pin
- Link önizlemeleri/embed'ler sayılmaz
- **Dosya**: Mesajdaki gerçek ek sayısı (10 ekli mesaj = 1 pin + 10 dosya)
- **Fotoğraf/GIF**: Eklerin içerik türüne göre ayrımı

### Komutlar

| Komut | Açıklama |
|------|----------|
| `.pin add <id>` | Kategori ekle |
| `.pin remove <id>` | Kategori kaldır |
| `.pin categories` | Takip edilen kategorileri listele |
| `.pin role <id>` | Staff rolü ayarla |
| `.pin stats` | Sunucu istatistikleri |
| `.pin stats <kullanıcıID>` | Kullanıcı istatistikleri |
| `.pin logs <kullanıcıID>` | Kullanıcının pin geçmişi |
| `.pin ignore add/remove <id>` | Kanalı yoksay listesine ekle/çıkar |
| `.pin scan` | Sunucuyu tara |
| `.pin backfill` | Eski mesajları geri yükle |

### Kurulum

1. Depoyu klonla: `git clone https://github.com/K1at3s/pin-bot.git`
2. Bağımlılıkları yükle: `npm install`
3. `.env.example` dosyasını `.env` olarak kopyala ve doldur
4. Botu başlat: `npm start`
5. Kategori ekle: `.pin add <kategoriID>`

---

## English

### Overview

Pin Bot tracks attached media messages in selected Discord categories. It stores pin, file, photo, and GIF statistics in MongoDB.

- **Pin count**: Number of messages containing at least one attachment
- **File count**: Total number of attachments
- **Photo/GIF**: Attachment type breakdown

### Features

- **Category-based tracking**: Manage categories with `.pin add <id>` / `.pin remove <id>`
- **Ignored channels**: Exclude specific channels from tracking
- **Scan & Backfill**: Scan existing messages with `.pin scan` and `.pin backfill`
- **Stats & logs**: `.pin stats` and `.pin logs <id>`
- **Role setting**: Set a staff role with `.pin role <id>`

### Counting Rule

- **Pin**: A message with at least one real attachment (`message.attachments`) = 1 pin
- Link previews/embeds are not counted
- **File**: Number of real attachments in the message (10 attachments = 1 pin + 10 files)
- **Photo/GIF**: Split by attachment content type

### Commands

| Command | Description |
|---------|-------------|
| `.pin add <id>` | Add a category |
| `.pin remove <id>` | Remove a category |
| `.pin categories` | List tracked categories |
| `.pin role <id>` | Set staff role |
| `.pin stats` | Server statistics |
| `.pin stats <userId>` | User statistics |
| `.pin logs <userId>` | User pin history |
| `.pin ignore add/remove <id>` | Add/remove channel from ignore list |
| `.pin scan` | Scan the server |
| `.pin backfill` | Restore old messages |

### Installation

1. Clone the repo: `git clone https://github.com/K1at3s/pin-bot.git`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill it in
4. Start the bot: `npm start`
5. Add a category: `.pin add <categoryId>`

## .env

```env
DISCORD_TOKEN=your_discord_bot_token_here
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=ticket_bot
PREFIX=.
PIN_TRACKER_ROLE_ID=
IGNORED_CHANNEL_IDS=
PIN_TRACKER_ENABLED=true
```

## Project Structure

```text
src/
  commands/Pin/pin.js        # .pin subcommands
  handlers/pinTracker.js     # Scan/record/category sync logic
  schemas/
    PinCategory.js
    PinLog.js
    PinStat.js
  config.js
  database.js
  index.js                   # Bot entry point
```

## Notes / Notlar

- `.env` dosyasını repoya eklemeyin. / Do not commit your `.env` file.
- Botun Discord Developer Portal'da `Guilds`, `GuildMessages`, `MessageContent` intent'lerine ihtiyacı vardır. / The bot requires `Guilds`, `GuildMessages`, and `MessageContent` intents in the Discord Developer Portal.
