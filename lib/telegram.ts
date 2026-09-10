export type TelegramSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

let cachedBotUsername = "";
let webhookPromise: Promise<{ ok: boolean; error?: string; url?: string }> | null = null;

export function publicAppUrl() {
  return (process.env.AUTH_URL || "").replace(/\/$/, "");
}

export function telegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || cachedBotUsername;
}

export function telegramDeepLink(token: string) {
  const bot = telegramBotUsername();
  if (!bot) return null;
  return `https://t.me/${bot}?start=${token}`;
}

export async function resolveBotUsername() {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || "";
  if (fromEnv) {
    cachedBotUsername = fromEnv;
    return fromEnv;
  }
  if (cachedBotUsername) return cachedBotUsername;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "";
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    cachedBotUsername = json.result?.username || "";
  } catch {
    cachedBotUsername = "";
  }
  return cachedBotUsername;
}

function telegramWebhookBase() {
  const base = publicAppUrl();
  if (!base || /localhost|127\.0\.0\.1/i.test(base)) return "";
  if (!base.startsWith("https://")) return "";
  return base;
}

export async function ensureTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set." };
  if (!telegramWebhookBase()) {
    return { ok: false, error: "AUTH_URL must be the public HTTPS site for Telegram." };
  }
  if (!webhookPromise) webhookPromise = registerTelegramWebhook();
  return webhookPromise;
}

async function registerTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set." };
  const base = telegramWebhookBase();
  if (!base) return { ok: false, error: "AUTH_URL must be the public HTTPS site for Telegram." };
  const url = `${base}/api/telegram/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
        allowed_updates: ["message"],
      }),
    });
    const json = (await res.json()) as { ok?: boolean; description?: string };
    if (!json.ok) {
      webhookPromise = null;
      return { ok: false, error: json.description || "setWebhook failed.", url };
    }
    await resolveBotUsername();
    return { ok: true, url };
  } catch (error) {
    webhookPromise = null;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram network error",
    };
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "Telegram bot is not configured.", retryable: false };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!json.ok) {
      const retryable = res.status >= 500 || res.status === 429;
      return {
        ok: false,
        error: json.description || `Telegram HTTP ${res.status}`,
        retryable,
      };
    }
    return { ok: true, messageId: String(json.result?.message_id ?? "") };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram network error",
      retryable: true,
    };
  }
}
