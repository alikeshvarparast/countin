import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withClubShell } from "@/components/club-shell";
import { InstallGuide } from "@/components/install-guide";
import { ProfileForm } from "@/components/profile-form";
import { ProfileSection } from "@/components/profile-section";
import { PushSettings } from "@/components/push-settings";
import { TelegramConnect } from "@/components/telegram-connect";
import { Card } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { userHasPushSubscription } from "@/lib/push";
import { resolveBotUsername, telegramBotUsername, telegramDeepLink } from "@/lib/telegram";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user) return null;
  const bot = (await resolveBotUsername()) || telegramBotUsername();
  if (!user.telegramLinkToken) {
    const token = createId();
    db.update(users).set({ telegramLinkToken: token }).where(eq(users.id, user.id)).run();
    user.telegramLinkToken = token;
  }
  const link = telegramDeepLink(user.telegramLinkToken);

  const body = (
    <main className="mx-auto w-full max-w-lg px-4 py-10 lg:px-0 lg:py-0">
      <h1 className="font-display text-2xl">Profile</h1>
      <Card className="mt-8">
        <ProfileForm
          name={user.name}
          email={user.email}
          telegram={user.telegramUsername}
          whatsapp={user.whatsappPhone ?? ""}
          paymentInfo={user.paymentInfo ?? ""}
          imageUrl={user.imageUrl}
        />
      </Card>
      <ProfileSection title="Home Screen app" id="home-screen" defaultOpen>
        <InstallGuide />
      </ProfileSection>
      <ProfileSection title="Phone notifications">
        <PushSettings enabled={userHasPushSubscription(user.id)} />
      </ProfileSection>
      <ProfileSection title="Help">
        <p className="text-sm text-ink/60">Send feedback or a support request to {APP_NAME}.</p>
        <Link href="/app/support" className="mt-3 inline-block text-sm text-primary">
          Open help →
        </Link>
      </ProfileSection>
      <ProfileSection title="Telegram bot">
        <TelegramConnect linked={Boolean(user.telegramChatId)} href={link} bot={bot} />
      </ProfileSection>
    </main>
  );

  return withClubShell(body);
}
