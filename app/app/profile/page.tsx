import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getClubMembership, hintedMemberClub } from "@/lib/access";
import { ClubNav } from "@/components/club-nav";
import { ProfileForm } from "@/components/profile-form";
import { PushSettings } from "@/components/push-settings";
import { TelegramConnect } from "@/components/telegram-connect";
import { Card } from "@/components/ui";
import { APP_NAME, CLUB_COOKIE, LEGACY_CLUB_COOKIE } from "@/lib/brand";
import { countUnreadChat } from "@/lib/chat";
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
  const jar = await cookies();
  const hintedRaw = jar.get(CLUB_COOKIE)?.value ?? jar.get(LEGACY_CLUB_COOKIE)?.value;
  const hinted = hintedRaw ? decodeURIComponent(hintedRaw) : undefined;
  const community = hintedMemberClub(user.id, hinted);
  const membership = community ? getClubMembership(community.id, user.id) : undefined;
  const unreadChat = community ? countUnreadChat(community.id, user.id) : 0;

  const body = (
    <main className="mx-auto w-full max-w-lg px-4 py-10 lg:px-0 lg:py-0">
      <h1 className="font-display text-2xl">Profile</h1>
      <Card className="mt-8 space-y-4">
        <ProfileForm
          name={user.name}
          email={user.email}
          telegram={user.telegramUsername}
          whatsapp={user.whatsappPhone ?? ""}
          imageUrl={user.imageUrl}
        />
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg">Phone notifications</h2>
        <div className="mt-2">
          <PushSettings enabled={userHasPushSubscription(user.id)} />
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg">Help</h2>
        <p className="mt-2 text-sm text-ink/60">Send feedback or a support request to {APP_NAME}.</p>
        <Link href="/app/support" className="mt-3 inline-block text-sm text-primary">
          Open help →
        </Link>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg">Telegram bot</h2>
        <TelegramConnect linked={Boolean(user.telegramChatId)} href={link} bot={bot} />
      </Card>
    </main>
  );

  if (!community || !membership) return body;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <ClubNav slug={community.slug} name={community.name} imageUrl={community.imageUrl} unreadChat={unreadChat} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-6 lg:pb-6 lg:pt-6">
        {body}
      </div>
    </div>
  );
}
