# CountIn

CountIn is a web app for running recurring group sessions: polls, RSVPs, waitlists, prepaid seasons, and a shared ledger. Alerts go to an in-app inbox and a Telegram bot.

## Run locally

```bash
npm install
cp .env.example .env.local
# set AUTH_SECRET to a long random string
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). SQLite is created at `data/countin.db` on first request. An existing `data/pitchside.db` is renamed to `countin.db` automatically.

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

## Operator console

CountIn Ops is a **separate site**, not a page inside CountIn.

Locally it is [http://ops.localhost:3000](http://ops.localhost:3000). In production set `OPS_HOST` to that hostname (for example a second tunnel or `ops.yourdomain.com`) pointing at the same server.

The CountIn URL will not show or open the operator console.

Operator login (seeded):

- Username: `owner`
- Password: `Owner123!@#`

Grant access to another account with either:

```bash
npx tsx scripts/grant-ops.ts you@email.com
```

or set `PLATFORM_OWNER_EMAILS=you@email.com` in `.env.local` (comma-separated for more than one operator).

Members send feedback and support from **Help** in CountIn. Replies from Ops show on that ticket.

WhatsApp uses the same `notify()` pipeline and is off until `WHATSAPP_ENABLED=true` plus a future Meta Cloud API adapter.

## License

Copyright (c) 2026 [KeshvarCo](https://keshvarco.com). See [LICENSE](LICENSE).
