import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
  };
};

export async function POST(request: NextRequest) {
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
  if (!chatId || !text.startsWith("/start")) {
    return NextResponse.json({ ok: true });
  }

  const token = text.replace("/start", "").trim();
  let user = token
    ? db.select().from(users).where(eq(users.telegramLinkToken, token)).get()
    : undefined;

  if (!user && username) {
    user = db
      .select()
      .from(users)
      .where(and(eq(users.telegramUsername, username)))
      .get();
  }
  if (!user && telegramUserId) {
    user = db
      .select()
      .from(users)
      .where(eq(users.telegramUsername, String(telegramUserId)))
      .get();
  }

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  db.update(users)
    .set({ telegramChatId: String(chatId) })
    .where(eq(users.id, user.id))
    .run();

  await sendTelegramMessage(
    String(chatId),
    `Linked to Pitchside as ${user.name}. You'll get polls, invites, and session alerts here.`,
  );

  return NextResponse.json({ ok: true });
}
