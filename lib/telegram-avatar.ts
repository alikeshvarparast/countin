import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { downloadTelegramProfilePhoto } from "@/lib/telegram";
import { saveImageBuffer } from "@/lib/uploads";

/**
 * Copy Telegram profile photo into the app avatar when allowed.
 * @param force replace even if the user already has an imageUrl
 */
export async function applyTelegramProfilePhoto(userId: string, force = false) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { ok: false as const, error: "User not found." };
  if (!force && user.imageUrl) return { ok: true as const, skipped: true as const, imageUrl: user.imageUrl };
  if (!user.telegramChatId) {
    return { ok: false as const, error: "Link Telegram first, then try again." };
  }

  const downloaded = await downloadTelegramProfilePhoto(user.telegramChatId);
  if (!downloaded.ok) return { ok: false as const, error: downloaded.error };

  try {
    const imageUrl = saveImageBuffer(
      downloaded.buffer,
      "users",
      user.id,
      downloaded.mime,
      "telegram.jpg",
    );
    if (!imageUrl) return { ok: false as const, error: "Could not save the Telegram photo." };
    db.update(users).set({ imageUrl }).where(eq(users.id, user.id)).run();
    return { ok: true as const, imageUrl, skipped: false as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not save the Telegram photo.",
    };
  }
}
