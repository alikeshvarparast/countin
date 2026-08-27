import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { regenerateTelegramLink, updateProfile } from "@/lib/actions/community";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { telegramBotUsername, telegramDeepLink } from "@/lib/telegram";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user) return null;
  const bot = telegramBotUsername();
  const link = user.telegramLinkToken ? telegramDeepLink(user.telegramLinkToken) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-4xl">Profile</h1>
      <Card className="mt-8 space-y-4">
        <form
          action={async (formData) => {
            "use server";
            await updateProfile(formData);
          }}
          className="space-y-4"
        >
          <Field label="Name">
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Telegram username or ID">
            <Input name="telegram" defaultValue={user.telegramUsername} required />
          </Field>
          <Field label="WhatsApp (later)">
            <Input name="whatsapp" defaultValue={user.whatsappPhone ?? ""} placeholder="+1…" />
          </Field>
          <SubmitButton>Save</SubmitButton>
        </form>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-2xl text-lime">Telegram bot</h2>
        {user.telegramChatId ? (
          <p className="mt-2 text-sm text-cream/70">Linked. DMs will arrive from the Pitchside bot.</p>
        ) : (
          <div className="mt-2 space-y-3 text-sm text-cream/70">
            <p>Messages are not linked yet. Telegram will not deliver until you start the bot.</p>
            {link ? (
              <a href={link} className="inline-block text-lime" target="_blank" rel="noreferrer">
                Open @{bot || "bot"} and tap Start
              </a>
            ) : (
              <p>
                Set <code>TELEGRAM_BOT_USERNAME</code> in the environment to generate a start link. You can still use the
                in-app inbox.
              </p>
            )}
            <form
              action={async () => {
                "use server";
                await regenerateTelegramLink();
              }}
            >
              <SubmitButton variant="ghost">New start link</SubmitButton>
            </form>
          </div>
        )}
      </Card>
    </main>
  );
}
