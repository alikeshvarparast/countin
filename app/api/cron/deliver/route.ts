import { NextRequest, NextResponse } from "next/server";
import { retryPendingDeliveries } from "@/lib/notify";
import { sendDeadlineReminders } from "@/lib/reminders";
import { ensureTelegramWebhook } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const webhook = await ensureTelegramWebhook();
  const retried = await retryPendingDeliveries();
  await sendDeadlineReminders();
  return NextResponse.json({ ok: true, retried, telegram: webhook.ok });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
