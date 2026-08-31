# WA Bot Termux — TikTok Downloader & Sticker Maker

Bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys), login pakai **pairing code** (tanpa scan QR).

## Fitur
- `.tiktok <link>` / `.tt <link>` — download video TikTok **HD, tanpa watermark**
- `.ttmp3 <link>` — download **audio/mp3** dari video TikTok
- `.sticker` / `.s` / `.stiker` — bikin stiker dari **foto** atau **video** (kirim langsung dengan caption, atau reply media lalu ketik command)
- `.menu` / `.help` — liat daftar command

## 1. Install dependency di Termux

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg python build-essential
```

> `ffmpeg` wajib ada karena dipakai buat convert video/foto jadi stiker.
> `python` & `build-essential` buat jaga-jaga kalau ada native module yang perlu di-compile.

## 2. Setup project

Kalau kamu udah punya foldernya (dari sini), tinggal masuk foldernya:

```bash
cd wa-bot-termux
npm install
```

Kalau mau mulai dari GitHub kamu sendiri, upload folder ini ke repo `jampingkuda2-bot`, terus di Termux:

```bash
git clone https://github.com/jampingkuda2-bot/NAMA-REPO-KAMU.git
cd NAMA-REPO-KAMU
npm install
```

## 3. Jalanin bot

```bash
node index.js
```

Nanti bot bakal minta nomor WhatsApp kamu di terminal:

```
📱 Masukin nomor WhatsApp kamu (format 62xxxxxxxxxx, tanpa + atau spasi):
```

Masukin nomor **pakai kode negara**, contoh `6281234567890` (tanpa `+`, tanpa spasi/strip).

Setelah itu muncul kode pairing 8 digit:

```
🔑 Kode pairing kamu: ABCD-1234
```

Buka WhatsApp di HP kamu → **Setelan** → **Perangkat Tertaut** → **Tautkan dengan nomor telepon** → masukin kode itu. Setelah berhasil, di terminal bakal muncul `✅ Bot berhasil tersambung ke WhatsApp!`

Session login kesimpen di folder `session/`, jadi lain kali jalanin `node index.js` lagi ga perlu pairing ulang (selama session belum dihapus/logout).

## 4. Biar bot tetep jalan walau Termux ditutup (opsional)

Pakai `tmux` atau `screen` biar proses ga mati waktu kamu tutup aplikasi Termux:

```bash
pkg install -y tmux
tmux new -s wabot
node index.js
# tekan Ctrl+B lalu D buat detach (bot tetep jalan di background)
# buat balik lagi: tmux attach -t wabot
```

Kalau HP suka "membunuh" proses background, aktifkan juga **Termux:Boot** / disable battery optimization buat Termux di setelan Android.

## Struktur file

```
wa-bot-termux/
├── index.js          # entry point, handler pesan & command
├── package.json
├── lib/
│   ├── tiktok.js      # logic download TikTok (video HD no-WM + mp3)
│   └── sticker.js     # logic convert foto/video ke stiker WA
└── session/           # (otomatis dibuat) nyimpen sesi login
```

## Catatan
- Downloader TikTok pakai API publik `tikwm.com`. Kalau sewaktu-waktu API ini down/berubah, tinggal ganti logic di `lib/tiktok.js`.
- Stiker video otomatis dipotong maksimal 10 detik (standar WhatsApp).
- Jangan commit folder `session/` ke GitHub publik — itu isinya kredensial login WA kamu. Tambahin ke `.gitignore`.
- 
