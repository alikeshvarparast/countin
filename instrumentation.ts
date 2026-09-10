export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureTelegramWebhook } = await import("./lib/telegram");
  await ensureTelegramWebhook().catch(() => undefined);
}
