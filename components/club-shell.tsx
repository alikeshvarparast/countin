import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getClubMembership, hintedMemberClub } from "@/lib/access";
import { ClubNav } from "@/components/club-nav";
import { CLUB_COOKIE, LEGACY_CLUB_COOKIE } from "@/lib/brand";
import { countUnreadChat } from "@/lib/chat";
import { countLedgerActions } from "@/lib/ledger-status";

/** Keep club Home / Members / Ledger nav when visiting app-wide pages like Help. */
export async function withClubShell(body: React.ReactNode) {
  const session = await auth();
  if (!session?.user?.id) return body;

  const jar = await cookies();
  const hintedRaw = jar.get(CLUB_COOKIE)?.value ?? jar.get(LEGACY_CLUB_COOKIE)?.value;
  const hinted = hintedRaw ? decodeURIComponent(hintedRaw) : undefined;
  const community = hintedMemberClub(session.user.id, hinted);
  const membership = community ? getClubMembership(community.id, session.user.id) : undefined;
  if (!community || !membership) return body;

  const unreadChat = countUnreadChat(community.id, session.user.id);
  const ledgerActions = countLedgerActions(community.id, session.user.id);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <ClubNav
        slug={community.slug}
        name={community.name}
        imageUrl={community.imageUrl}
        unreadChat={unreadChat}
        ledgerActions={ledgerActions}
      />
      <div className="pitch-wash flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-6 lg:pb-6 lg:pt-6">
        {body}
      </div>
    </div>
  );
}
