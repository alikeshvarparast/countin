import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClubMembership, getCommunityBySlug } from "@/lib/access";
import { countUnreadChat } from "@/lib/chat";
import { ClubNav } from "@/components/club-nav";
import { LedgerDisclaimer } from "@/components/ledger-disclaimer";
import { countLedgerActions } from "@/lib/ledger-status";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const membership = getClubMembership(community.id, session.user.id);
  if (!membership) redirect(`/communities/${slug}`);
  const unreadChat = countUnreadChat(community.id, session.user.id);
  const ledgerActions = countLedgerActions(community.id, session.user.id);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <ClubNav
        slug={slug}
        name={community.name}
        imageUrl={community.imageUrl}
        unreadChat={unreadChat}
        ledgerActions={ledgerActions}
      />
      <div className="pitch-wash relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
      <LedgerDisclaimer
        slug={slug}
        communityName={community.name}
        accepted={Boolean(membership.ledgerAcceptedAt)}
      />
    </div>
  );
}
