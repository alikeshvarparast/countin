import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getClubMembership, hintedMemberClub } from "@/lib/access";
import { regenerateTelegramLink } from "@/lib/actions/community";
import { ClubNav } from "@/components/club-nav";
import { ProfileForm } from "@/components/profile-form";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { APP_NAME, CLUB_COOKIE, LEGACY_CLUB_COOKIE } from "@/lib/brand";
import { countUnreadChat } from "@/lib/chat";
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
        <h2 className="font-display text-lg">Help</h2>
        <p className="mt-2 text-sm text-ink/60">Send feedback or a support request to {APP_NAME}.</p>
        <Link href="/app/support" className="mt-3 inline-block text-sm text-primary">
          Open help →
        </Link>
      </Card>
      <Card className="mt-6">
        <h2 className="font-display text-lg">Telegram bot</h2>
        {user.telegramChatId ? (
          <p className="mt-2 text-sm text-cream/70">Linked. DMs will arrive from the {APP_NAME} bot.</p>
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
