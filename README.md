# ⚡ ROMA MD

**ROMA MD** is a WhatsApp Multi-Device bot powered by Baileys.

The bot connects directly to WhatsApp — there is **no external session-ID generator** and no `SESSION_ID` environment variable.

## ✨ Features

- 📱 Built-in WhatsApp connection page
- 🔳 QR-code pairing
- 🔢 WhatsApp pairing code
- 🟢 Live connection status
- 💾 Local authentication storage — restart without pairing again
- 🤖 AI plugins
- 📥 Download plugins
- 🛠️ Bot utilities
- 🏠 Public/private bot mode
- 🐳 Docker support
- ☁️ Render/VPS friendly

## 🔗 How to connect

After starting ROMA MD, open the web panel:

```
http://YOUR_SERVER:10000/
```

The page provides both connection methods:

### QR Code

1. Open the ROMA MD web panel.
2. Wait for the QR code.
3. On WhatsApp, open **Linked devices → Link a device**.
4. Scan the QR code.
5. Wait until the page shows **Connected**.

### Pairing Code

1. Open the ROMA MD web panel.
2. Enter your WhatsApp phone number with country code.
3. Click **Get Pairing Code**.
4. On WhatsApp, open **Linked devices → Link with phone number instead**.
5. Enter the displayed code.
6. Wait until the page shows **Connected**.

> You do not need to generate, copy, or paste any `SESSION_ID`.

## 💾 Authentication storage

ROMA MD stores WhatsApp authentication files in the directory configured by `AUTH_DIR`.

For Docker/VPS, keep this directory on a persistent volume. Once WhatsApp is linked, restarting the bot will reuse the saved authentication and normally will not require pairing again.

**Do not delete the authentication directory unless you intentionally want to unlink the bot.**

## 🚀 Local installation

```bash
git clone https://github.com/ansadser/roma-md.git
cd roma-md
cp .env.example .env
npm install
npm start
```

Then open:

```
http://localhost:10000/
```

## 🖥️ VPS / Docker deployment

```bash
git clone https://github.com/ansadser/roma-md.git
cd roma-md
cp .env.example .env
docker compose up -d --build
docker compose logs -f roma-md
```

The Docker setup persists authentication in:

```
./auth_info_baileys
```

## ⚙️ Environment variables

```env
AUTH_DIR=./auth_info_baileys
PORT=10000
WEB_TOKEN=
MODE=public
PREFIX=.
OWNER_NUMBER=
BOT_NAME=ROMA MD
LANGUAGE=English
```

### Web panel protection

Set `WEB_TOKEN` if the connection page should require a token:

```env
WEB_TOKEN=your-strong-random-token
```

Then open:

```
http://YOUR_SERVER:10000/?token=your-strong-random-token
```

Keep the token private.

## 🌐 Health check

The server exposes:

```
GET /health
```

Example response:

```json
{"ok":true,"status":"connected"}
```

## 📂 Project structure

```
.
├── core/
│   ├── http.js
│   ├── pair.js
│   ├── plugin.js
│   └── web.js
├── plugins/
├── auth_info_baileys/     # created automatically; keep persistent
├── config.js
├── index.js
├── Dockerfile
├── docker-compose.yml
└── render.yaml
```

## 🔥 Plugins

ROMA MD includes plugins for:

- AI
- Facebook
- Instagram
- Lyrics
- Menu
- Ping
- Spotify
- Twitter/X
- YouTube

Add or modify plugins inside the `plugins/` directory.

## ☁️ Render deployment

The included `render.yaml` uses a persistent disk for WhatsApp authentication.

Configure at least:

- `OWNER_NUMBER`
- optionally `WEB_TOKEN`

After deployment, open the Render service URL and use the built-in connection page.

## 🔐 Security

- Never share your WhatsApp authentication directory.
- Keep `WEB_TOKEN` private if the web panel is exposed publicly.
- Do not commit `.env` or `auth_info_baileys/` to GitHub.
- If the bot is no longer needed, unlink it from WhatsApp Linked Devices.

## 📜 License

Use and modify ROMA MD according to the repository license.

<div align="center">

### 💙 ROMA MD

**Direct WhatsApp connection • QR + Pairing Code • Persistent authentication**

</div>
