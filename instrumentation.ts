export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureTelegramWebhook } = await import("./lib/telegram");
  await ensureTelegramWebhook().catch(() => undefined);

  // One-shot demo directory seed (skips if data/.demo-directory-v18 exists).
  void import("./lib/seed-demo-directory")
    .then(({ seedDemoDirectory }) => seedDemoDirectory())
    .then((result) => {
      if (!result.skipped) console.log("[seed] demo directory ready");
    })
    .catch((err) => console.error("[seed] demo directory failed", err));
}
