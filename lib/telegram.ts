export type TelegramSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

export function telegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || "";
}

export function telegramDeepLink(token: string) {
  const bot = telegramBotUsername();
  if (!bot) return null;
  return `https://t.me/${bot}?start=${token}`;
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
