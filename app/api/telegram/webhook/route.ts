import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { APP_NAME } from "@/lib/brand";
import { ensureTelegramWebhook, sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
  };
};

function parseStart(text: string) {
  const match = text.trim().match(/^\/start(?:@\S+)?(?:\s+(\S+))?$/i);
  if (!match) return null;
  return match[1] ?? "";
}

function findUserForStart(token: string, username?: string, telegramUserId?: number) {
  if (token) {
    const byToken = db.select().from(users).where(eq(users.telegramLinkToken, token)).get();
    if (byToken) return byToken;
  }
  const keys = [username ?? "", telegramUserId != null ? String(telegramUserId) : ""]
    .map((value) => value.replace(/^@/, "").trim().toLowerCase())
    .filter((value) => value.length >= 3);
  for (const key of keys) {
    const row = db
      .select()
      .from(users)
      .where(sql`lower(${users.telegramUsername}) = ${key}`)
      .get();
    if (row) return row;
  }
  return undefined;
}

export async function GET() {
  const result = await ensureTelegramWebhook();
  return NextResponse.json({ ok: result.ok, error: result.error ?? null });
}

export async function POST(request: NextRequest) {
  await ensureTelegramWebhook();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  const username = update.message?.from?.username;
  const telegramUserId = update.message?.from?.id;
  const startToken = parseStart(text);
  if (!chatId || startToken == null) {
    return NextResponse.json({ ok: true });
  }

  const user = findUserForStart(startToken, username, telegramUserId);
  if (!user) {
    await sendTelegramMessage(
      String(chatId),
      `We could not match this Telegram to a ${APP_NAME} account. Open Profile in the app, tap the bot start link, then Start here.`,
    );
    return NextResponse.json({ ok: true });
  }

  db.update(users)
    .set({
      telegramChatId: String(chatId),
      ...(username ? { telegramUsername: username.replace(/^@/, "") } : {}),
    })
    .where(eq(users.id, user.id))
    .run();

  await sendTelegramMessage(
    String(chatId),
    `Linked to ${APP_NAME} as ${user.name}. You'll get polls, invites, and session alerts here.`,
  );

  return NextResponse.json({ ok: true });
}
