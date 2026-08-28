import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClubMembership, getCommunityBySlug } from "@/lib/access";
import { countUnreadChat } from "@/lib/chat";
import { ClubNav } from "@/components/club-nav";
import { LedgerDisclaimer } from "@/components/ledger-disclaimer";

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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <ClubNav slug={slug} name={community.name} imageUrl={community.imageUrl} unreadChat={unreadChat} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-6 lg:pb-6 lg:pt-6">
        {children}
      </div>
      <LedgerDisclaimer
        slug={slug}
        communityName={community.name}
        accepted={Boolean(membership.ledgerAcceptedAt)}
      />
    </div>
  );
}
