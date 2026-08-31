const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const readline = require('readline');
const { tiktokDownload } = require('./lib/tiktok');
const { toStickerFromImage, toStickerFromVideo } = require('./lib/sticker');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  // Pakai pairing code cuma kalau belum pernah login sebelumnya
  const usePairingCode = !state.creds.registered;

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
    browser: ['WA Bot Termux', 'Chrome', '1.0.0'],
  });

  if (usePairingCode) {
    let phoneNumber = await ask('\n📱 Masukin nomor WhatsApp kamu (format 62xxxxxxxxxx, tanpa + atau spasi): ');
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n🔑 Kode pairing kamu: ${code}\n`);
        console.log('Buka WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon, lalu masukin kode di atas.\n');
      } catch (e) {
        console.error('❌ Gagal minta pairing code:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Koneksi terputus. Reconnect:', shouldReconnect);
      if (shouldReconnect) startBot();
      else console.log('❌ Logged out. Hapus folder "session" lalu jalanin ulang buat login baru.');
    } else if (connection === 'open') {
      console.log('✅ Bot berhasil tersambung ke WhatsApp!');
      if (rl && !rl.closed) rl.close();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const type = Object.keys(msg.message)[0];

      const body =
        type === 'conversation'
          ? msg.message.conversation
          : type === 'extendedTextMessage'
          ? msg.message.extendedTextMessage.text
          : type === 'imageMessage'
          ? msg.message.imageMessage.caption || ''
          : type === 'videoMessage'
          ? msg.message.videoMessage.caption || ''
          : '';

      const text = (body || '').trim();
      const command = text.split(' ')[0].toLowerCase();
      const args = text.split(' ').slice(1).join(' ').trim();

      // ===== MENU =====
      if (command === '.menu' || command === '.help') {
        await sock.sendMessage(from, { text: menuText() }, { quoted: msg });
        return;
      }

      // ===== TIKTOK VIDEO (HD, no watermark) =====
      if (command === '.tiktok' || command === '.tt') {
        if (!args) {
          await sock.sendMessage(
            from,
            { text: 'Kirim link TikTok-nya ya.\nContoh: .tiktok https://vt.tiktok.com/xxxx' },
            { quoted: msg }
          );
          return;
        }
        await sock.sendMessage(from, { text: '⏳ Lagi proses download video, bentar ya...' }, { quoted: msg });
        try {
          const result = await tiktokDownload(args);
          if (!result.video) throw new Error('URL video tidak ditemukan');
          await sock.sendMessage(
            from,
            {
              video: { url: result.video },
              caption: `✅ *${result.title}*\n👤 ${result.author}\n\nHD • Tanpa Watermark 🚀`,
            },
            { quoted: msg }
          );
        } catch (e) {
          await sock.sendMessage(
            from,
            { text: '❌ Gagal download video.\n' + e.message },
            { quoted: msg }
          );
        }
        return;
      }

      // ===== TIKTOK MP3 =====
      if (command === '.ttmp3' || command === '.tiktokmp3') {
        if (!args) {
          await sock.sendMessage(
            from,
            { text: 'Kirim link TikTok-nya ya.\nContoh: .ttmp3 https://vt.tiktok.com/xxxx' },
            { quoted: msg }
          );
          return;
        }
        await sock.sendMessage(from, { text: '⏳ Lagi ambil audio, bentar ya...' }, { quoted: msg });
        try {
          const result = await tiktokDownload(args);
          if (!result.music) throw new Error('Audio tidak ditemukan di video ini');
          await sock.sendMessage(
            from,
            {
              audio: { url: result.music },
              mimetype: 'audio/mpeg',
              fileName: `${(result.title || 'tiktok-audio').slice(0, 50)}.mp3`,
            },
            { quoted: msg }
          );
        } catch (e) {
          await sock.sendMessage(from, { text: '❌ Gagal ambil audio.\n' + e.message }, { quoted: msg });
        }
        return;
      }

      // ===== STICKER MAKER (foto / video) =====
      if (command === '.sticker' || command === '.s' || command === '.stiker') {
        const ctx = msg.message.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        const targetMsg = quoted
          ? { message: quoted, key: { ...msg.key, id: ctx.stanzaId, remoteJid: from } }
          : msg;
        const targetType = quoted ? Object.keys(quoted)[0] : type;

        if (targetType === 'imageMessage') {
          await sock.sendMessage(from, { text: '⏳ Bikin stiker dari foto...' }, { quoted: msg });
          try {
            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
            const stickerBuffer = await toStickerFromImage(buffer);
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
          } catch (e) {
            await sock.sendMessage(from, { text: '❌ Gagal bikin stiker.\n' + e.message }, { quoted: msg });
          }
        } else if (targetType === 'videoMessage') {
          await sock.sendMessage(from, { text: '⏳ Bikin stiker dari video (max 10 detik)...' }, { quoted: msg });
          try {
            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
            const stickerBuffer = await toStickerFromVideo(buffer);
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
          } catch (e) {
            await sock.sendMessage(from, { text: '❌ Gagal bikin stiker dari video.\n' + e.message }, { quoted: msg });
          }
        } else {
          await sock.sendMessage(
            from,
            { text: 'Kirim foto/video langsung dengan caption *.sticker*, atau reply foto/video terus ketik *.sticker*' },
            { quoted: msg }
          );
        }
        return;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });
}

function menuText() {
  return `🤖 *WA BOT MENU*

📥 *TikTok Downloader*
• .tiktok <link> — download video HD tanpa watermark
• .tt <link> — alias
• .ttmp3 <link> — download audio/mp3

🎨 *Sticker Maker*
• .sticker — kirim/reply foto atau video (video max 10 detik)
• .s / .stiker — alias

Ketik *.menu* buat liat menu ini lagi.`;
}

startBot();
