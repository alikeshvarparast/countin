# Pitchside

Web app for football communities: weekly pickup (poll → RSVP → book → split cost) and prepaid seasons (contracts, waitlists, replacement invites). Money is a ledger. Alerts go to an in-app inbox and a Telegram bot.

## Run locally

```bash
npm install
cp .env.example .env.local
# set AUTH_SECRET to a long random string
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). SQLite is created at `data/pitchside.db` on first request.

Optional demo data (Alex admin + Sam player, password `password123`):

```bash
npx tsx scripts/seed.ts
```

### Telegram (optional)

1. Create a bot with [BotFather](https://t.me/BotFather).
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in `.env.local`.
3. Point the webhook at `/api/telegram/webhook` (or use a tunnel in development).
4. After register, members open the bot start link so DMs can be delivered.

Delivery retries: `GET /api/cron/deliver` with `Authorization: Bearer $CRON_SECRET`.

WhatsApp uses the same `notify()` pipeline and is off until `WHATSAPP_ENABLED=true` plus a future Meta Cloud API adapter.
